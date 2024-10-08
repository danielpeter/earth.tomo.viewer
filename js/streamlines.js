/***
* magma earth - a 3D Earth web viewer project to visualize global seismic models
*
* Copyright (c) 2024 Daniel Peter
* MIT License - https://opensource.org/license/mit
***/

// streamlines
//
// creates streamlines by storing particle motions

import * as vectorField from "./vectorField.js";  // vector field


// streamlines
const numPaths = 64800;    // number of streamlines: 64800 -> 1 x 1 degree samples
const numPathLength = 6;   // number of point positions per streamline

const useRegularLocations = true;  // use regular lon/lat start positions instead of randomized ones

// streamlines array
let streamlines = null;

// streamlines velocity factor
const STRETCH_FACTOR = 4.0; // to make streamlines longer

// streamline drawing
const streamlineSize = 1.0;
const ADAPT_STREAMLINESIZE = false; // adapt line width to zoom factor

// quantized color scale for color buckets
let colorScale = null;
const NUM_COLORS = 10; // number of quantized colors

// regular stepping for start locations
let StartLon = -180.0, StartLat = -90.0;
let deltaLon = 1.0, deltaLat = 1.0;
let nLonSteps = 0, nLatSteps = 0;
let currentLon, currentLat;

// constants
const DEGREE_TO_RADIAN = Math.PI / 180;


// Initialize streamlines
function initializeStreamlines() {

  // check if vector field is ready
  if (! vectorField.isGradientValid()) return;

  console.log(`streamlines: initializeStreamlines: streamlines ${numPaths} * ${numPathLength}`);

  // total number of streamline positions
  const numPositions = numPaths * numPathLength;

  // streamlines array
  if (streamlines == null) {
    streamlines = new Float32Array(numPositions * 4); // x, y, vx, vy
  }

  // loop over paths
  for (let n = 0; n < numPaths; n++) {
    createPath(n);
  }

  // Create a quantized color scale with 10 discrete steps
  const startColor = "rgba(155, 155, 155, 0.4)";
  const endColor = "rgba(255, 255, 155, 0.4)";

  // interpolator
  const colorInterpolator = d3.interpolateRgb(startColor, endColor);

  // scale
  colorScale = d3.scaleQuantize()
                    .domain([0.0, 1.0])    // normalized velocity range
                    .range(d3.quantize(colorInterpolator, NUM_COLORS));
}


// Initialize streamlines
function createPath(n) {
  //console.log(`streamlines: createPath: ${n}`);
  // initial path point
  //let x = Math.random() * width; // x
  //let y = Math.random() * height; // y

  //let vx = scaleFactor * (Math.random() - 0.5) * 2; // vx
  //let vy = scaleFactor * (Math.random() - 0.5) * 2; // vy

  let lon,lat;

  if (useRegularLocations) {
    // regular increments

    // first path initalization
    if (n == 0){
      // determine number of steps along lon/lat direction
      const dincr = Math.sqrt( (360.0 * 180.0) / numPaths );
      nLonSteps = Math.floor(360.0 / dincr); // number of steps along lon-direction
      nLatSteps = Math.floor(180.0 / dincr); // number of steps along lat-direction

      // add a longitudinal step in case we undersample
      while (nLonSteps * nLatSteps < numPaths){
        nLonSteps += 1;
      }

      if (nLonSteps <= 0) nLonSteps = 1;
      if (nLatSteps <= 0) nLatSteps = 1;

      deltaLon = 360.0 / nLonSteps;
      deltaLat = 180.0 / nLatSteps;

      console.log(`streamlines: regular paths ${numPaths} - nsteps ${nLonSteps} ${nLatSteps} delta lon/lat = ${deltaLon}/${deltaLat}`);

      // shift away from pole and meridian
      currentLon = StartLon + deltaLon / 2;
      currentLat = StartLat + deltaLat / 2;
    }

    // set to current start position
    lon = currentLon;
    lat = currentLat;

    // update for next streamline
    currentLon += deltaLon;
    if ((n > 0) && (n % nLonSteps == 0)){
      // reached end of longitude line, increment latitude and reset longitude
      currentLon = StartLon + deltaLon / 2; // re-start longitudes
      currentLat += deltaLat;
    }

    // if beyond range, keep old position
    if (currentLon > 180.0) currentLon -= deltaLon;
    if (currentLat > 90.0) currentLat -= deltaLat;

  } else {
    // randomized start location
    lon = (Math.random() - 0.5) * 360; // in [-180,180]
    lat = (Math.random() - 0.5) * 180; // in [-90,90]
  }

  //if (n < 10) console.log(`streamlines: paths ${n} - lon/lat = ${lon}/${lat}`);

  // limit latitute [-90,90]
  if (lat < -90.0) { lat = -90.0;}
  if (lat >  90.0) { lat =  90.0;}

  // limit lon [-180,180]
  if (lon < -180.0) { lon = -180.0;}
  if (lon >  180.0) { lon =  180.0;}

  // moves points according to vector field:
  //   vx - x direction == lon
  //   vy - y direction == lat
  // pre-allocate vector
  const vector = new Float32Array(2);

  vectorField.getVectorField(lon, lat, vector);

  // check if valid
  if (!vector[0] || !vector[1]){ return; }

  // scale velocities
  vector[0] *= STRETCH_FACTOR; // vx
  vector[1] *= STRETCH_FACTOR; // vy

  // or simple vector field
  //const lonRad = lon * DEGREE_TO_RADIAN;
  //const latRad = lat * DEGREE_TO_RADIAN;
  //vx = 4.0 * Math.sin(latRad) * Math.cos(lonRad);
  //vy = 4.0 * Math.cos(latRad);

  // check velocity
  if (! useRegularLocations) {
    // if particle doesn't move, re-create path
    const norm = (vector[0]*vector[0] + vector[1]*vector[1]);
    if (norm == 0.0) { createPath(n); }
  }

  for (let m = 0; m < numPathLength; m++) {
    // position index
    const i = n * numPathLength + m;

    // add streamline position
    streamlines[i * 4] = lon;            // x or lon
    streamlines[i * 4 + 1] = lat;        // y or lat
    streamlines[i * 4 + 2] = vector[0];  // vx
    streamlines[i * 4 + 3] = vector[1];  // vy

    // updates position
    lon += vector[0];
    lat += vector[1];

    // updates velocity direction
    vectorField.getVectorField(lon, lat, vector);

    // check if valid
    if (!vector[0] || !vector[1]){ return; }

    // scale velocities
    vector[0] *= STRETCH_FACTOR; // vx
    vector[1] *= STRETCH_FACTOR; // vy
  }
}

// clear streamline arrays
function clearStreamlines() {

  console.log(`streamlines: clearStreamlines`);

  // check if streamlines array is valid
  if (!streamlines) return;

  // reset reference array
  streamlines = null;
}


// update streamline positions
function updateStreamlines() {

  // check if vector field is ready
  if (! vectorField.isGradientValid()) return;

  // check if streamlines array is valid
  if (!streamlines) return;

  // check if regular start locations, then we keep those
  if (useRegularLocations) return;

  //console.log(`updateStreamlines: streamlines ${streamlines.length/4}`);
  console.time('updateStreamlines');

  // loop over paths
  for (let n = 0; n < numPaths; n++) {
    createPath(n);
  }

  console.timeEnd('updateStreamlines');
}

// draw streamlines
function drawStreamlines(projection, context) {

  //console.log(`drawStreamlines: streamlines ${streamlines.length/4}`);

  // check if streamlines array is valid
  if (streamlines == null) return;

  console.time('drawStreamlines');

  // hemisphere check
  function isPointVisibleHemisphere(v0,v1) {
    // dotProduct is > 0 for points in same hemisphere
    const dotProduct = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
    return (dotProduct >= 0);
  }

  // determine lon/lat of center point
  const width = context.canvas.width;
  const height = context.canvas.height;

  // center pixel
  const ix = Math.floor(width * 0.5);
  const iy = Math.floor(height * 0.5);

  const p = projection.invert([ix,iy]);
  // check if valid
  if (!p || isNaN(p[0]) || isNaN(p[1])) { return false; }

  // position vector
  let latRad, lonRad;

  // center vector
  lonRad = p[0] * DEGREE_TO_RADIAN;
  latRad = p[1] * DEGREE_TO_RADIAN;
  const vCenter = [ Math.cos(latRad) * Math.cos(lonRad), Math.cos(latRad) * Math.sin(lonRad), Math.sin(latRad) ];

  // determine line width based on zoom
  let lineWidth = streamlineSize;
  if (ADAPT_STREAMLINESIZE) {
    let k = 1.0, scaleZoom = 1.0;
    const transform = d3.zoomTransform(d3.select("#navigation").node());
    if (transform != null){
      k = transform.k; // 313 to 6266...
      const windowSize = Math.min(context.canvas.width,context.canvas.height);
      scaleZoom = k / windowSize; // stronger zoom -> higher k -> thicker lines
    }
    lineWidth = (scaleZoom < 1) ? streamlineSize : Math.floor(streamlineSize * scaleZoom);
    //console.log(`drawStreamlines: line width ${lineWidth}`);
  }

  projection.clipAngle(90);

  // position vectors
  const v0 = [0, 0, 0];
  const v1 = [0, 0, 0];

  let p0 = [0,0];
  let p1 = [0,0];

  //debug
  //let isDone = false;

  for (let i = 0; i < streamlines.length/4; i++) {
    const index = i * 4;

    // initial position
    //const x0 = streamlines[index];
    //const y0 = streamlines[index + 1];

    // updated position
    //const x1 = x0 + streamlines[index + 2];
    //const y1 = y0 + streamlines[index + 3];

    // lon/lat positions
    // initial position
    const lon0 = streamlines[index];
    const lat0 = streamlines[index + 1];

    const vx = streamlines[index + 2];
    const vy = streamlines[index + 3];

    // velocity strength
    const norm = Math.sqrt(vx * vx + vy * vy) / STRETCH_FACTOR;  // in [0,1]

    // updated position
    const lon1 = lon0 + vx;
    const lat1 = lat0 + vy;

    // current point location vector
    const lonRad0 = lon0 * DEGREE_TO_RADIAN;
    const latRad0 = lat0 * DEGREE_TO_RADIAN;
    v0[0] = Math.cos(latRad0) * Math.cos(lonRad0);
    v0[1] = Math.cos(latRad0) * Math.sin(lonRad0);
    v0[2] = Math.sin(latRad0);

    const lonRad1 = lon1 * DEGREE_TO_RADIAN;
    const latRad1 = lat1 * DEGREE_TO_RADIAN;
    v1[0] = Math.cos(latRad1) * Math.cos(lonRad1);
    v1[1] = Math.cos(latRad1) * Math.sin(lonRad1);
    v1[2] = Math.sin(latRad1);

    if(! isPointVisibleHemisphere(vCenter,v0)) { continue; }
    if(! isPointVisibleHemisphere(vCenter,v1)) { continue; }

    // converted to x/y
    p0 = projection([lon0,lat0]);
    p1 = projection([lon1,lat1]);

    // check if valid
    if (!p0 || isNaN(p0[0]) || isNaN(p0[1])) { continue; }
    if (!p1 || isNaN(p1[0]) || isNaN(p1[1])) { continue; }

    // check if point is visible area
    // doesn't work, returned [x,y] pixel positions are all within globe area...
    //const [x0,y0] = p0;
    //const [x1,y1] = p1;
    //if (! isPointClose([x0,y0])) { continue; }
    //if (! isPointClose([x1,y1])) { continue; }

    // Draw streamline
    // coloring
    //let color;
    // same as bumpMap coloring
    //color = d3.interpolatePuBu(1 - val);
    // red
    //color = d3.interpolateYlOrBr(1 - val);
    // Determine color based on velocity
    let color = colorScale(norm);

    // alpha value based on path position index
    const n = i % numPathLength;
    const val = ((n+1) / numPathLength); // in [0.1,1]

    let alpha = 0.1 + 0.2 * val;
    if (alpha > 1.0) alpha = 1.0;

    //if (index == 0) console.log(`drawStreamlines: ${lon0}/${lat0} to ${lon1}/${lat1} alpha ${alpha}`);

    // add transparency
    color = d3.color(color).copy({opacity: alpha});

    //debug
    //if (! isDone) {
    //  console.log(`drawStreamlines: transform ${transform} k ${k} ${scaleZoom} ${context.canvas.width} ${context.canvas.height} lineWidth ${lineWidth}`);
    //  isDone = true;
    //}

    // line
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.moveTo(p0[0], p0[1]);
    context.lineTo(p1[0], p1[1]);
    context.stroke();
  }

  console.timeEnd('drawStreamlines');
}


export { initializeStreamlines, clearStreamlines, updateStreamlines, drawStreamlines };
