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
      file: 'lib/index.js',
      format: 'cjs'
    }
  },
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
    ],
    output: {
      file: 'es/index.js',
      format: 'es'
    }
  },
  {
    input: 'src/index.js',
    external: [],
    name: 'crosslink-plotly.js',
    plugins: [
      nodeResolve(),
      commonjs(),
      buble({
        objectAssign: 'Object.assign'
      })
    ],
    output: {
      file: 'dist/crosslink-plotly.js',
      format: 'umd'
    }
  },
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
      file: 'dist/crosslink-plotly.min.js',
      format: 'umd'
    }
  }


];