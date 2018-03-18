async function refresh() {
  const response = await fetch("history.json");
  const history = response.ok ? await response.json() : {};
  const names = Object.keys(history).filter(name => name[0] != "@").sort();
  const timestamps = history["@timestamp"];

  const graphsDiv = document.getElementById("graphs");
  while (graphsDiv.firstChild) graphsDiv.removeChild(graphsDiv.firstChild);

  for (const name of names) {
    const points = history[name].map((v, i) => v == null ? null : [ i, v ]).filter(p => p != null);
    // draw a straight line when we have exactly one data point:
    if (points.length == 1) points.push([ points[0][0] + 1, points[0][1] ]);
    const pMax = rankedPoint(points, getY), pMin = rankedPoint(points, p => -getY(p));

    const graphDiv = document.getElementById("graph-template").cloneNode(true);
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
    graphDiv.addEventListener("click", e => {
      if (div("details").textContent.length > 0) {
        div("details").innerHTML = "";
      } else {
        div("details").innerHTML = details;
      }
    });

    graphsDiv.appendChild(graphDiv);
  }

  document.getElementById("current-time").textContent = iso(Date.now());
}

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

function rankedPoint(points, f) {
  return [...points].sort((a, b) => f(b) - f(a))[0];
}

const getX = p => p[0];
const getY = p => p[1];
const iso = ts => new Date(ts).toISOString();

setInterval(refresh, 5000);
refresh();
