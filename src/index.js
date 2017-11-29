import {map, clone, values, range, toPairs} from 'ramda';
import {walkObject, makeAttrSetterPath} from './utils/objectUtils';
import crossfilter from 'crossfilter2';

const cf = crossfilter2;

const CROSSFILTER_WHITELISTED_PLOTS = [
  'bar',
  'box',
  'choropleth',
  'histogram',
  'pie',
  'scatter',
  'scatter3d',
  'scattergeo',
  'scattermapbox',
  'table'
];

// crossfilter salience constants
const DESELECTDIM = 0.1;
const DESELECTDIM_MAPBOX = 0.01;

const srcFieldSuffix = 'src';

// STREAMBED SPECIFIC STUFF

const keepColumnId = /[^:]+(?=[^:]*$)/;

const gridSourceAttribute = key => key.slice(-srcFieldSuffix.length) === 'src';
const getBaseAttributeName = key => key.slice(0, -srcFieldSuffix.length);
const getPlotArray = root => [].slice.call(root.querySelectorAll('.js-plotly-plot'));

// STREAMBED SPECIFIC STUFF END

const collectFieldSourcesInTrace = (plotEl, trace, traceIndex) => walkObject(trace, (key, d, currentPathArray) => {

  // our common (shared) crossfilter is persisted on `gd` elements but `plotly.js` itself isn't using it so
  // it'd be possible to persist it purely in `streambed` - but we'll also need it in `plotly.js-crossfilter`
  const crossfilter = plotEl._crossfilter;

  // currently, table headers get populated from the grid but they must not
  // change just because crossfilter eliminates some rows; `header` not to change
  const tableHeader = trace.type === 'table' && currentPathArray[0] === 'header';

  // now it's just one condition but there may be other ignored nodes in the future
  // a future version of `walkObject` might supply config for ignoring nodes/paths
  const ignoredPath = tableHeader;

  if (ignoredPath) {
    return;
  }

  if (gridSourceAttribute(key)) {

    // we cut off the first two `:`-delimited parts (username etc.) and
    // just retain the column uid
    const value = d[key].match(keepColumnId)[0];
    const srcFieldName = key;
    const fieldName = getBaseAttributeName(srcFieldName);

    const newFields = [];

    if (trace.type === 'table' && currentPathArray[0] === 'cells') {

      // streambed puts comma-separated column names in one single src field
      // as a solution to the issue that `cells.values` etc. can be columns themselves
      // - this code only handles columns, ie. doesn't handle scalars
      const columns = value.replace(/\*/g, '').split(',');
      columns.forEach((subValue, i) => {
        const pathArray = currentPathArray.concat([fieldName, i]);
        newFields.push({
          gd: plotEl,
          srcFieldName,
          traceIndex,
          data: d[fieldName][i],
          pathArray,
          fieldPath: makeAttrSetterPath(pathArray),
          constrained: false,
          gridColumnName: subValue
        });
      });

    } else {

      // this object will be used to keep track of per field (attribute) info
      newFields.push({
        gd: plotEl,
        srcFieldName,
        traceIndex,
        data: d[fieldName],
        pathArray: currentPathArray.concat([fieldName]),
        fieldPath: makeAttrSetterPath(currentPathArray.concat([fieldName])),
        constrained: false,
        gridColumnName: value
      });
    }

    // adding them to the field sources map
    newFields.forEach(field => {
      crossfilter.fieldSources[field.gridColumnName] = (crossfilter.fieldSources[field.gridColumnName] || [])
        .concat(field);
    });
  }
}, {walkArraysMatchingKeys: ['transforms']});

const eventPointsToDataPoints = (gd, eventPoints) => {
  const points = {};
  for (let i = 0; i < eventPoints.length; i++) {
    const p = eventPoints[i];
    const transforms = p.fullData && p.fullData.transforms;
    const activeTransforms = transforms ? transforms.filter(tr => tr._indexToPoints) : [];
    if (activeTransforms.length) {
      const lastTransform = activeTransforms[activeTransforms.length - 1];
      lastTransform._indexToPoints[p.pointNumber].forEach(n => {points[n] = {pointNumber: n};});
    } else {
      if (gd._fullData[0].type === 'pie') {
        for (let j = 0; j < gd.data[0].labels.length; j++) {
          if (gd.data[0].labels[j] === p.label) { points[j] = {pointNumber: j};}
        }
      } else {
        points[p.pointNumber] = p;
      }
    }
  }
  return points;
};

const isDashboardCompliantForCrossfilter = data => {

  // crossfilter can only be enabled if all trace types can react to filtering, though
  // this condition may be relaxed in the future; some crossfiltered dashboards may have
  // static content
  const allTraceTypesWhiteListedForCrossfilter =
          data.every(trace => CROSSFILTER_WHITELISTED_PLOTS.indexOf(trace.type) !== -1);

  // ensuring that all grids are of identical length
  // this constraint can be relaxed in the future when one dashboard may have multiple
  // unrelated grids that crossfilter separately; though it'll require careful dashboard design for users
  const gridAttribValueLengths = {};
  data.forEach(trace => Object.keys(trace).filter(gridSourceAttribute).forEach(key => {
    const gridColumnLength = trace[getBaseAttributeName(key)].length;
    gridAttribValueLengths[gridColumnLength] = true;
  }));
  const identicalLengths = Object.keys(gridAttribValueLengths).length < 2;

  // actual participation requires that each trace has some grid backed attributes
  // as there turned out to be actual plots on `prod` that didn't use grid
  // data
  let allTracesHaveSomeGridBackendAttribute = false;
  data.some(trace => walkObject(trace, key => {
    if (gridSourceAttribute(key)) {
      allTracesHaveSomeGridBackendAttribute = true;
    }
  }, {walkArraysMatchingKeys: ['transforms']}));

  // dashboard can do crossfiltering if all conditions are met
  return (
    allTraceTypesWhiteListedForCrossfilter &&
    allTracesHaveSomeGridBackendAttribute &&
    identicalLengths
  );
};

const setDeepProp = (rootObject, path, valueToSet) => {
  for (let i = 0, obj = rootObject; i < path.length; i++) {
    const key = path[i];
    const value = obj[key];
    const found = value !== void 0;
    if (i === path.length - 1) {
      obj[key] = valueToSet;
    } else if (!found) {
      obj[key] = {};
    }
    obj = obj[key];
  }
};

const gridBackedAttribute = key => key.slice(-srcFieldSuffix.length) === 'src';

const eraseGridPropsFromTrace = traceObject => walkObject(traceObject, (key, d, path) => {
  if (gridBackedAttribute(key) && path[0] !== 'header') {
    d[getBaseAttributeName(key)] = [];
  }
}, {walkArraysMatchingKeys: ['transforms']});

export const cfEnabled = (crossfiltering, plotContent) =>
  crossfiltering && isDashboardCompliantForCrossfilter(plotContent.data);

export const cfLayoutOverrides = {dragmode: 'select', showlegend: false};

const getCrossfilter = plotArray => plotArray.length ? plotArray[0]._crossfilter : {
  fieldSources: {},
  cf: null,
  grid: {}
};

const persistCrossfilter = (plotEl, crossfilter) => {
  plotEl._crossfilter = crossfilter;
};

const restylePlots = (Plotly, crossfilter, plotArray) => {

  const someConstrained = crossfilter.plotDimensions.concat(crossfilter.formDimensions).some(dim => dim.constrained);
  const newSet = someConstrained ? crossfilter.recordDimension.top(Infinity).sort((a, b) => a.index - b.index) : [];

  plotArray.filter(gd => gd.includedInCrossfilter).forEach(ogd => {

    // create an add'l trace for saliently showing the retained set
    // by copying the (assumed single) trace
    const crossfilterSalientTraces = ogd._cfData.originalData.map(clone);

    // initially, all records are kept ie. no point is salient
    crossfilterSalientTraces.forEach(eraseGridPropsFromTrace);

    const plotFields = [].concat.apply([], values(crossfilter.fieldSources))
      .filter(fs => fs.gd === ogd);
    plotFields.forEach(field => {
      const value = newSet.map(rec => rec[field.gridColumnName]);
      crossfilterSalientTraces.forEach((trace, i) => {
        if (i !== field.traceIndex) {
          return;
        }
        setDeepProp(trace, field.pathArray, value);
        const referenceMarker = ogd._fullData[i].marker || {};
        const colorIsArray = Plotly.Lib.isArray(referenceMarker.color);
        const directlyColored = !colorIsArray
          || colorIsArray && !Plotly.Lib.isNumeric(referenceMarker.color[0]);
        if (trace.type !== 'pie' && ogd._fullData[i].marker && directlyColored) {
          trace.marker = trace.marker || {};
          trace.marker.color = ogd._fullData[i].marker.color;
        }
      });
    });

    Plotly.deleteTraces(ogd, range(ogd._cfData.originalData.length, ogd.data.length));
    if (someConstrained && ogd._fullData.length === ogd._cfData.originalData.length) {
      Plotly.addTraces(ogd, crossfilterSalientTraces);
    }
    crossfilterSalientTraces.forEach((trace, i) => dimTracePostStyle(Plotly, ogd, someConstrained, trace, i));
  });
};

const resetAllFilters =
        crossfilter => crossfilter.plotDimensions.concat(crossfilter.formDimensions).forEach(dim => {
          dim.constrained = false;
          if (dim.cfDimension) {
            dim.cfDimension.filter(null);
          }
        });

export const resetCrossfilter = Plotly => {
  const plots = getPlotArray(document);
  const crossfilter = plots[0]._crossfilter;
  resetAllFilters(crossfilter);
  restylePlots(Plotly, crossfilter, [...plots].filter(gd => gd.includedInCrossfilter));
};

export const specFilter = (Plotly, spec) => {
  const plots = getPlotArray(document);
  const gridColumn = spec.gridColumn;
  const value = spec.isNaN ? spec.value : Number(spec.value);
  const relation = spec.operator;
  const crossfilter = plots[0]._crossfilter;
  const dim = crossfilter.formDimensions[0];
  dim.constrained = true;
  if (dim.cfDimension) {
    dim.cfDimension.filter(null);
    dim.cfDimension.dispose();
    dim.cfDimension = null;
    dim.constrained = false;
  }
  dim.cfDimension = crossfilter.cf.dimension(d => d[gridColumn]);
  const filterFunctionMap = {
    '>': d => d > value,
    '<': d => d < value,
    '==': d => d === value
  };
  const filterFunction = filterFunctionMap[relation];
  dim.cfDimension.filterFunction(filterFunction);
  dim.constrained = true;

  restylePlots(Plotly, crossfilter, [...plots].filter(gd => gd.includedInCrossfilter));
}

const selectionHandler = (Plotly, gd, inputEventData) => {
  // the crossfilter object is attached to the `gd` but shared among all `gd`s of a dashboard
  const crossfilter = gd._crossfilter;
  const plotDimension = crossfilter.plotDimensions.find(dim => dim.gd === gd);

  // in case of fully covering things eg. `pie` the salient layer becomes the capture layer
  const eventPoints = getEventPoints(gd, plotDimension, inputEventData);

  // all filters be cleared until we add per-plot `Reset` and persistent selection box / lasso
  resetAllFilters(crossfilter);

  const points = eventPointsToDataPoints(gd, eventPoints);

  plotDimension.constrained = eventPoints.length > 0;
  if (!plotDimension.constrained) {
    gd.querySelectorAll('.select-outline').forEach(e => e.parentNode.removeChild(e));
  }
  plotDimension.cfDimension.filterFunction(plotDimension.constrained ? d => points[d] : () => true);
  Plotly.restyle(gd, 'selectedpoints', null);
  restylePlots(Plotly, crossfilter, getPlotArray(document).filter(gd => gd.includedInCrossfilter));
};

export const cfPlotSetup = (Plotly, plotArray, gdPromise, plotEl, plotContent) => {

  const crossfilter = getCrossfilter(plotArray);
  persistCrossfilter(plotEl, crossfilter);

  /*********************
   * Crossfilter setup
   */

  plotContent.data.forEach((trace, i) => collectFieldSourcesInTrace(plotEl, trace, i));

  Object.keys(crossfilter.fieldSources).forEach(gridColumnName => {
    const fieldSource = crossfilter.fieldSources[gridColumnName];
    crossfilter.grid[gridColumnName] = fieldSource[0].data;
  });

  crossfilter.cf = cf();

  /************************
   * Event handler setup
   */

  gdPromise.then(gd => {
    if (gd._fullData[0].type === 'pie') {
      gd.on('plotly_click', selectionHandler.bind(0, Plotly, gd));
    } else {
      gd.on('plotly_selected', selectionHandler.bind(0, Plotly, gd));
    }
    gd.includedInCrossfilter = true;

    crossfilter.plotDimensions = getPlotArray(document)
      .filter(gd => gd.includedInCrossfilter)
      .map(gd => {
        return {
          gd,
          constrained: false,
          cfDimension: crossfilter.cf.dimension(d => d.index)
        };
      });

    crossfilter.formDimensions = [
      {
        gd: void(0),
        constrained: false,
        cfDimension: null
      }
    ];

    plotEl._cfData = {
      originalData: plotEl.data.map(clone),
      originalFullData: plotEl._fullData.map(clone),
      originalOpacity: map(e => e.style.opacity)(plotEl.querySelectorAll('.trace'))
    };
  });

  crossfilter.recordDimension = crossfilter.cf.dimension(d => d);

  const gridArray = toPairs(crossfilter.grid);

  if (gridArray.length) {
    const records = gridArray[0][1].map((col, i) => {
      const record = {};
      for (let j = 0; j < gridArray.length; j++) {
        record.index = i;
        record[gridArray[j][0]] = gridArray[j][1][i];
      }
      return record;
    });

    crossfilter.cf.add(records);
  }
};

function getEventPoints(gd, plotDimension, inputEventData) {

  // in the case of pies, clicking on pie again resets the filter
  let eventData = plotDimension.constrained && gd._fullData[0].type === 'pie' ? null : inputEventData;

  if (gd._fullData[0].type === 'pie') {
    return eventData ? eventData.points : [];
  }

  if (gd._fullData[0].type === 'histogram') {

    eventData = {points: []};

    if (inputEventData && !Array.isArray(inputEventData)) {

      inputEventData.points.forEach(p => {

        // convert `calcdata` format to regular event points format
        const points = p.pointNumbers || gd.calcdata[0][p.pointNumber].pts;

        points.forEach(pp => {
          eventData.points.push({
            pointNumber: pp,
            curveNumber: p.curveNumber,
            data: p.data,
            fullData: p.fullData
          });
        });
      });
    }
  }

  return eventData ?
    eventData.points.filter(p =>
      p.curveNumber < gd._cfData.originalData.length && p.data.uid === gd.data[p.curveNumber].uid) :
    [];
}

function toggleContextHover(Plotly, gd, traceIndex, dim) {
  // it's necessary to disable context hover not just for UX reasons but also
  // because the values may become misleading and out of sync with the
  // colorscale

  // disable / restore the hover tooltip of the context layer
  const targetHoverInfo = dim ? 'none' : gd._cfData.originalFullData[traceIndex].hoverinfo;
  if (targetHoverInfo
    && gd._fullData[traceIndex].hoverinfo !== targetHoverInfo
    && ['scattermapbox', 'scattergeo', 'scatter3d'].indexOf(gd._fullData[0].type) === -1) {
    Plotly.restyle(gd, 'hoverinfo', targetHoverInfo, [traceIndex]);
  }
}

function dimTracePostStyle(Plotly, gd, dim, trace, traceIndex) {

  const gdSel = Plotly.d3.select(gd);

  switch (trace.type) {

    case 'choropleth': {

      toggleContextHover(Plotly, gd, traceIndex, dim);

      // direct CSS styling for very fast update
      // here the real solution will also be `Plotly.react`, can be combined with the above `hoverinfo` setting

      const originalOpacity = gd._cfData.originalOpacity[traceIndex];

      // due to a weird issue the paths remain faded after selection unless user double-clicks - this fixes it
      gdSel.selectAll('.trace path').style('opacity', 1);

      // make the context invisible so as there's minimal interference with color reading
      gdSel.selectAll('.trace').filter((d, i) => i === traceIndex).style('opacity', dim ? 0 : originalOpacity);

      // show/hide colorbar without going through another `restyle` call
      gdSel.selectAll('.colorbar .cbaxis').style('opacity', 0);
      window.setTimeout(() => {
        // for some reason, colorbar gets updated asynchronously so it'll only be there in the future
        gdSel.selectAll('.colorbar .cbaxis').style('opacity', (d, i) => i === traceIndex && dim ? 0 : null);
      });
      return;
    }

    case 'scatter':
    case 'box': {

      toggleContextHover(Plotly, gd, traceIndex, dim);

      // make the context, including its legends, dimmed
      const originalOpacity = gd._cfData.originalOpacity[traceIndex];
      gdSel.selectAll('.trace')
        .filter((d, i) => i === traceIndex)
        .style('opacity', dim ? DESELECTDIM : originalOpacity);

      return;
    }

    case 'bar': {
      toggleContextHover(Plotly, gd, traceIndex, dim);

      if (gd.layout.barmode === 'stack') {
        Plotly.restyle(gd, 'visible', !dim, range(0, gd._cfData.originalData.length));
      } else {
        // make the context, including its legends, dimmed
        const originalOpacity = gd._cfData.originalOpacity[traceIndex];
        gdSel.selectAll('.trace')
          .filter((d, i) => i === traceIndex)
          .style('opacity', dim ? DESELECTDIM : originalOpacity);
      }

      return;
    }

    case 'histogram': {

      const originalOpacity = gd._cfData.originalOpacity[traceIndex];
      gdSel.selectAll('.trace')
        .filter((d, i) => i === traceIndex)
        .style('opacity', dim ? 0 : originalOpacity);

      return;
    }

    case 'table': {
      // make the context invisible
      gdSel.select('.table').style('opacity', dim ? 0 : null);

      return;
    }

    case 'pie': {
      // make the context, including its legends, invisible
      gdSel.select('.trace').style('opacity', dim ? 0 : null);

      // hover text stays on pie after interaction without this
      gdSel.selectAll('.hovertext').remove();

      return;
    }

    case 'scattermapbox': {
      Plotly.restyle(gd, 'marker.opacity', dim ? DESELECTDIM_MAPBOX : 1, [traceIndex]);
      return;
    }

    case 'scatter3d': {
      Plotly.restyle(gd, 'marker.opacity', dim ?
        DESELECTDIM :
        gd._cfData.originalFullData[traceIndex].marker.opacity, [traceIndex]);
      return;
    }

    default: {
      Plotly.d3.select(gd).select('.trace').style('opacity', dim ? DESELECTDIM : null);
      return;
    }
  }
}
