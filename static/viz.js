// very simple/dumb UX to show each metric's current value and a tiny graph of its past values.

const getX = p => p[0];
const getY = p => p[1];
const iso = ts => new Date(ts).toISOString();

const showDetails = new Set();

async function refresh() {
  const timeDiv = document.getElementById("current-time");
  const graphsDiv = document.getElementById("graphs");
  const templateDiv = document.getElementById("graph-template");

  let response;
  try {
    response = await fetch("history.json");
  } catch (error) {
    console.log(error);
    graphsDiv.classList.add("error");
    return;
  }

  graphsDiv.classList.remove("error");
  timeDiv.textContent = iso(Date.now());
  if (!response.ok) {
    graphsDiv.classList.add("error");
    return;
  }

  const history = await response.json();
  const names = Object.keys(history).filter(name => name[0] != "@").sort();
  const timestamps = history["@timestamp"];

  while (graphsDiv.firstChild) graphsDiv.removeChild(graphsDiv.firstChild);

  for (const name of names) {
    const points = history[name].map((v, i) => [ i, v ]).filter(p => getY(p) != null);
    // draw a straight line when we have exactly one data point:
    if (points.length == 1) points.push([ getX(points[0]) + 1, getY(points[0]) ]);
    const pMax = rankedPoint(points, getY), pMin = rankedPoint(points, p => -getY(p));

    const graphDiv = templateDiv.cloneNode(true);
    const div = name => graphDiv.getElementsByClassName(name)[0];
    graphDiv.id = `graph-${name}`;
    div("name").textContent = name;
    if (points.length == 0) {
      div("value").textContent = "(none)";
    } else {
      div("value").textContent = points[points.length - 1][1].toString().slice(0, 11);
      drawSvg(div("svg"), points, getY(pMax));
    }

    const maxTime = iso(timestamps[getX(pMax)]).slice(11, 19);
    const minTime = iso(timestamps[getX(pMin)]).slice(11, 19);
    let details = `max [${maxTime}] ${getY(pMax)}<br>min [${minTime}] ${getY(pMin)}`;
    if (showDetails.has(name)) div("details").innerHTML = details;
    graphDiv.addEventListener("click", e => {
      if (showDetails.has(name)) {
        div("details").innerHTML = "";
        showDetails.remove(name);
      } else {
        div("details").innerHTML = details;
        showDetails.add(name);
      }
    });

    graphsDiv.appendChild(graphDiv);
  }
}

// mimic the code in peity
function drawSvg(svg, points, ymax) {
  const xOffset = 0.5, yOffset = 0, width = svg.width.baseVal.value - xOffset * 2, height = svg.height.baseVal.value;
  const pointsToSvg = points => points.map(([ x, y ]) => `${x} ${y}`).join(", ");

  const xmin = getX(points[0]), xmax = getX(points[points.length - 1]);
  const scaledPoints = points.map(([ x, y ]) => [
    xOffset + width * (x - xmin) / (xmax - xmin),
    (yOffset + height) - height * y / ymax
  ]);
  const polyPoints = [ [ xOffset, yOffset + height ], ...scaledPoints, [ xOffset + width, yOffset + height ] ];

  const polyline = svg.getElementsByTagName("polyline")[0];
  polyline.setAttribute("points", pointsToSvg(scaledPoints));
  const polygon = svg.getElementsByTagName("polygon")[0];
  polygon.setAttribute("points", pointsToSvg(polyPoints));
}

// return the point with the highest score for f(point)
function rankedPoint(points, f) {
  return [...points].sort((a, b) => f(b) - f(a))[0];
}


setInterval(refresh, 5000);
setTimeout(refresh, 0);
