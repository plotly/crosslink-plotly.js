const {cfEnabled, cfLayoutOverrides, cfPlotSetup} = window['crosslink-plotly'].js

const crossfiltering = true

const plots = [
  {plotContent: ebola1},
  {plotContent: ebola2},
  {plotContent: ebola3}
]

const renderOneDiv = idArray => {
  const root = idArray.length ? document.getElementById(`gd_${idArray.slice(0, -1).join('_')}`) : document.body
  const div = document.createElement('div')
  div.setAttribute('id', `gd_${idArray.join('_')}`)
  root.appendChild(div)
  return div
}

// render a root container
renderOneDiv([])

const renderedDivs = []

plots.forEach(({plotContent}, i) => {
  const plotEl = renderOneDiv([`ebola${i}`], true)
  const crossfilterEnabled = cfEnabled(crossfiltering, plotContent);
  const layout = Object.assign(plotContent.layout, crossfilterEnabled ? cfLayoutOverrides : {})
  const plot = Plotly.plot(plotEl, plotContent.data, layout);
  if (crossfilterEnabled) {
    cfPlotSetup(Plotly, renderedDivs, plot, plotEl, plotContent);
  }
  renderedDivs.push(plotEl)
})