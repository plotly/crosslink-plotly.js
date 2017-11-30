import buble from 'rollup-plugin-buble';
import uglify from 'rollup-plugin-uglify';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default [
  {
    input: 'src/index.js',
    external: [],
    name: 'crosslink-plotly.js',
    plugins: [
      nodeResolve(),
      commonjs(),
      buble({
        objectAssign: 'Object.assign'
      }),
      uglify()
    ],
    output: {
      file: 'lib/crosslink-plotly.min.js',
      format: 'cjs'
    }
  }
];