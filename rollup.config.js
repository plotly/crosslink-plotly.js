import buble from 'rollup-plugin-buble';
// import uglify from 'rollup-plugin-uglify';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'src/index.js',
  external: [],
  name: 'crosslink-plotly.js',
  plugins: [
//    uglify(),
    nodeResolve(),
    commonjs(),
    buble({
      objectAssign: 'Object.assign'
    })

  ],
  output: {
    file: 'dist/crosslink-plotly.min.js',
    format: 'es'
  }
};