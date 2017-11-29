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
    commonjs({
      include: 'node_modules/**',
     namedExports: {
        // left-hand side can be an absolute path, a path
        // relative to the current directory, or the name
        // of a module in node_modules
        // 'node_modules/crossfilter2/src/crossfilter.js': ['default']
      }
    }),
    buble({
      objectAssign: 'Object.assign'
    })

  ],
  output: {
    file: 'dist/crosslink-plotly.min.js',
    format: 'cjs'
  }
};