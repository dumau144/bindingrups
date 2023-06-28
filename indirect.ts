const range = (n = 0, m = 1) => new Array(n).fill(null).map((a, b) => b * m);

export const indirect = async (
  device: GPUDevice,
  context: GPUCanvasContext
) => {
  const module = device.createShaderModule({
    label: "Main module",
    code: /*wgsl*/ `
    struct InstanceData {
      color: vec4<f32>,
      translate: vec2<f32>,
      scale: f32,
      rotation: f32,
    };

    struct Input {
      @builtin(vertex_index) vertexIndex: u32,
      @builtin(instance_index) instanceIndex: u32,
    }
    
    @group(0) @binding(0) var<storage, read> dataIn: array<vec2f>;
    
    @group(0) @binding(1) var<storage, read> instanceData: array<InstanceData>;


      struct VSOut {
        @builtin(position) position: vec4f,
        @location(1) color: vec4f,
      }

      @vertex fn vertexShader(input: Input) -> VSOut {
        let INSTANCE = instanceData[input.instanceIndex];
        let tr: vec2<f32> = INSTANCE.translate;
      
        var out: VSOut;
        out.position = vec4f(dataIn[input.vertexIndex] + tr, 0.0, 1.0);
        out.color = INSTANCE.color;

        return out;
      }
      
      @fragment fn fs(input: VSOut) -> @location(0) vec4<f32> {
        return input.color;
      }
      
      @group(0)
      @binding(0)
      var<storage, read_write> data: vec4<u32>;

      @group(0)
      @binding(1)
      var<storage, read_write> stagingInstanceBuffer: array<InstanceData>;

      @group(0)
      @binding(2)
      var<storage, read_write> realInstanceBuffer: array<InstanceData>;


      @compute
      @workgroup_size(1)
      fn computeIndirect() {
        var virtualInstance: u32 = 0;

        for (var i = 0; i < 4; i++) {
          let instance = stagingInstanceBuffer[i];
          if (instance.translate.x >= -0.5 && instance.translate.x <= 0.5) {
            realInstanceBuffer[virtualInstance] = instance;
            virtualInstance += 1;
          }
        }

        data[1] = virtualInstance;
      }

      @group(0)
      @binding(0)
      var<storage, read_write> fakeStagingBuffer: array<InstanceData>;

      @group(0)
      @binding(1)
      var<uniform> time: f32;

      @compute
      @workgroup_size(1)
      fn updateLocations() {
        for (var i = 0; i < 4; i++) {
          var instance = fakeStagingBuffer[i];
          instance.translate.x += cos(time) * 0.01;
          
          fakeStagingBuffer[i] = instance;
          
        }
      }
      `,
  });

  const vb = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);

  const vertexBuffer = device.createBuffer({
    label: "vertexBuffer",
    size: vb.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, 0, vb);

  const instanceCount = 4;
  const instanceSize = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]).byteLength;

  const BUFFER_SIZE = instanceSize * instanceCount;

  const stagingInstanceBuffer = device.createBuffer({
    label: "stagingInstanceBuffer",
    size: instanceSize * instanceCount,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_DST,
  });

  const realInstanceBuffer = device.createBuffer({
    label: "realInstanceBuffer",
    size: instanceSize * instanceCount,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_DST,
  });

  const timeData = new Float32Array([0]);

  const timeBuffer = device.createBuffer({
    label: "timeBuffer",
    size: timeData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(timeBuffer, 0, timeData);

  const instanceDataBuffer = new ArrayBuffer(BUFFER_SIZE);

  for (const instanceIndex of range(instanceCount)) {
    const instanceByteOffset = instanceSize * instanceIndex;

    const InstanceDataViews = {
      color: new Float32Array(instanceDataBuffer, instanceByteOffset + 0, 4),
      translate: new Float32Array(
        instanceDataBuffer,
        instanceByteOffset + 16,
        2
      ),
      scale: new Float32Array(instanceDataBuffer, instanceByteOffset + 24, 1),
      rotation: new Float32Array(
        instanceDataBuffer,
        instanceByteOffset + 28,
        1
      ),
    };

    InstanceDataViews.color.set([
      Math.random(),
      Math.random(),
      Math.random(),
      1,
    ]);
    InstanceDataViews.translate.set([
      -1 + Math.random() * 2,
      -1 + Math.random() * 2,
    ]);
    InstanceDataViews.scale.set([0]);
    InstanceDataViews.rotation.set([0]);
  }

  device.queue.writeBuffer(stagingInstanceBuffer, 0, instanceDataBuffer);

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: {
      module: module,
      entryPoint: "vertexShader",
    },
    fragment: {
      module: module,
      entryPoint: "fs",
      targets: [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
        },
      ],
    },
  });

  const computePipeline = device.createComputePipeline({
    label: "our compute pipeline",
    layout: "auto",
    compute: {
      entryPoint: "computeIndirect",
      module,
    },
  });

  const updatePipeline = device.createComputePipeline({
    label: "update pipeline",
    layout: "auto",
    compute: {
      entryPoint: "updateLocations",
      module,
    },
  });

  const updateBindGroup = device.createBindGroup({
    label: "updateBindGroup",
    layout: updatePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: stagingInstanceBuffer },
      },
      {
        binding: 1,
        resource: { buffer: timeBuffer },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: vertexBuffer },
      },
      {
        binding: 1,
        resource: { buffer: realInstanceBuffer },
      },
    ],
  });

  const indirectArray = new Uint32Array(8);

  indirectArray[0] = 3;
  indirectArray[1] = instanceCount;
  indirectArray[2] = 0;
  indirectArray[3] = 0;

  const indirectBuffer = device.createBuffer({
    label: "indirectBuffer",
    size: indirectArray.byteLength,
    usage:
      GPUBufferUsage.INDIRECT |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.STORAGE,
  });

  device.queue.writeBuffer(indirectBuffer, 0, indirectArray);

  const computeBindGroup = device.createBindGroup({
    label: "Indirect bind group",
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: indirectBuffer },
      },
      {
        binding: 1,
        resource: { buffer: stagingInstanceBuffer },
      },
      {
        binding: 2,
        resource: { buffer: realInstanceBuffer },
      },
    ],
  });

  return (dt: number) => {
    const encoder = device.createCommandEncoder({ label: "our encoder" });

    timeData[0] = dt / 1000;

    device.queue.writeBuffer(timeBuffer, 0, timeData);

    {
      const computePass = encoder.beginComputePass({
        label: "Update position pass",
      });
      computePass.setPipeline(updatePipeline);
      computePass.setBindGroup(0, updateBindGroup);
      computePass.dispatchWorkgroups(1);
      computePass.end();
    }

    {
      const computePass = encoder.beginComputePass({
        label: "Indirect update command",
      });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(1);
      computePass.end();
    }

    {
      const pass = encoder.beginRenderPass({
        label: "our basic canvas renderPass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
  
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.drawIndirect(indirectBuffer, 0);
      pass.end();
    }

    

    const buffer = encoder.finish({ label: "a" });

    device.queue.submit([buffer]);
  };
};
