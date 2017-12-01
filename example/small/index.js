const {cfEnabled, cfLayoutOverrides, cfPlotSetup} = window['crosslink-plotly'].js

const crossfiltering = ebola.settings.enableCrossfilter

const config = {}

const getPlotArray = root => [].slice.call(root.querySelectorAll('.js-plotly-plot'));

const renderOneDiv = (idArray, verticalContainer) => {
  const root = idArray.length ? document.getElementById(`gd_${idArray.slice(0, -1).join('_')}`) : document.body
  const div = document.createElement('div')
  div.setAttribute('id', `gd_${idArray.join('_')}`)
  //if(idArray.length) div.setAttribute('class', 'js-plotly-plot')
  if (verticalContainer) {
    div.style['flex-direction'] = 'column'
  }
  root.appendChild(div)
  return div
}

renderOneDiv([])

const plots = [
  {plotContent: ebola1},
  {plotContent: ebola2},
  {plotContent: ebola3}
]

plots.forEach(({plotContent}, i) => {

  const plotEl = renderOneDiv([`ebola${i}`], true)

  const crossfilterEnabled = cfEnabled(crossfiltering, plotContent);

  const layout = plotContent.layout // this.scaledLayout(plotContent.layout, plotEl, setPlotContentToClientHeight);

  const plotPayload = {
    data: plotContent.data,
    layout: Object.assign(
      layout, // clone(layout),
      crossfilterEnabled ? cfLayoutOverrides : {}
    ),
    frames: plotContent.frames,
    config
  };

  const plotArray = getPlotArray(document);

  const gdPromise = Plotly.plot(plotEl, plotPayload);

  if (crossfilterEnabled) {
    cfPlotSetup(Plotly, plotArray, gdPromise, plotEl, plotContent);
  }
})