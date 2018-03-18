async function refresh() {
  const response = await fetch("history.json");
  const history = response.ok ? await response.json() : {};
  const names = Object.keys(history).filter(name => name[0] != "@").sort();

  const graphsDiv = document.getElementById("graphs");
  while (graphsDiv.firstChild) graphsDiv.removeChild(graphsDiv.firstChild);

  for (const name of names) {
    const points = history[name].map((v, i) => v == null ? null : [ i, v ]).filter(p => p != null);
    // draw a straight line when we have exactly one data point:
    if (points.length == 1) points.push([ points[0][0] + 1, points[0][1] ]);

    const graphDiv = document.getElementById("graph-template").cloneNode(true);
    const setText = (name, text) => graphDiv.getElementsByClassName(name)[0].textContent = text;
    graphDiv.id = `graph-${name}`;
    setText("name", name);
    if (points.length == 0) {
      setText("value", "(none)");
    } else {
      setText("value", points[points.length - 1][1].toString().slice(0, 11));
      drawSvg(graphDiv.getElementsByTagName("svg")[0], points);
    }
    graphsDiv.appendChild(graphDiv);
  }

  document.getElementById("current-time").textContent = new Date().toISOString();
}

function drawSvg(svg, points) {
  const xOffset = 0.5, yOffset = 0, width = svg.width.baseVal.value - xOffset * 2, height = svg.height.baseVal.value;
  const pointsToSvg = points => points.map(([ x, y ]) => `${x} ${y}`).join(", ");

  const xmin = points[0][0], xmax = points[points.length - 1][0];
  const ymax = Math.max(...points.map(([ x, y ]) => y));
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

setInterval(refresh, 5000);
refresh();
