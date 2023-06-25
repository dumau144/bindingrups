      @group(0) @binding(0) var<uniform, read> data: array<f32>;

      @vertex fn vertexShader(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        let pos = array(
          vec2f(-1.0, 1.0),
          vec2f( 1.0, 1.0),
          vec2f( 1.0,-1.0),
          vec2f(-1.0, 1.0),
          vec2f(-1.0,-1.0),
          vec2f( 1.0,-1.0),
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      struct FragIn{
        @builtin(position) coord_in: vec4<f32>
      }

      @fragment fn fs(input: FragIn) -> @location(0) vec4f {
        return vec4f(input.coord_in.x / data[0], input.coord_in.y / data[1], 0.0, 1.0);
      }