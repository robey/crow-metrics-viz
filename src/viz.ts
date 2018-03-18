import * as path from "path";
import { deltaSnapshots, Metrics, RingBuffer, RingBufferOptions } from "crow-metrics";
import * as express from "express";

// find our static folder -> ./lib/crow/viz/viz.js -> ./static
const staticPath = path.resolve(require.resolve(".."), "../../static");

type HistoryJson = { [key: string]: (number | null)[] };

// no extra options yet.
export interface VizOptions extends RingBufferOptions {}

/*
 * Create a sub-path on your existing web server for displaying per-server
 * metrics:
 *
 *     import { Metrics } from "crow-metrics";
 *     import { viz } from "crow-metrics-viz";
 *     import express from "express";
 *
 *     const app = express();
 *     const metrics = Metrics.create();
 *     app.use("/viz", viz(metrics));
 *     app.listen(8080);
 *
 * You can place it at any path you want.
 */
export function viz(metrics: Metrics, options: VizOptions = {}): express.Router {
  const router = express.Router();
  router.use("/", express.static(staticPath));

  const ringBuffer = new RingBuffer(options);
  metrics.events.map(deltaSnapshots()).attach(ringBuffer);

  router.get("/history.json", (request, response) => {
    response.type("json");
    response.send(JSON.stringify(getJsonHistory(ringBuffer), null, 2));
  });

  router.get("/debug.json", (request, response) => {
    response.type("json");
    response.send(JSON.stringify(ringBuffer.get().map(s => s.toJson()), null, 2));
  });

  router.get("/current.json", (request, response) => {
    const latest = ringBuffer.getLatest();
    response.type("json");
    response.send(JSON.stringify(latest ? latest.toJson() : {}, null, 2));
  });

  return router;
}

/*
 * Return the ring buffer history as an object, where each key is one metric,
 * and each value is the array of data points for that metric. A special
 * `@timestamp` key holds the array of timestamps covered.
 */
function getJsonHistory(ringBuffer: RingBuffer): HistoryJson {
  const snapshots = ringBuffer.get();
  const names = Array.from(new Set<string>(flatten(snapshots.map(s => s.flatten().keys())))).sort();

  const rv: HistoryJson = { "@timestamp": [] };
  for (const name of names) rv[name] = [];

  for (const s of snapshots) {
    const seen = new Set<string>();
    rv["@timestamp"].push(s.timestamp);
    for (const [ name, value ] of s.flatten()) {
      seen.add(name);
      rv[name].push(value);
    }
    for (const name of names) if (!seen.has(name)) rv[name].push(null);
  }
  return rv;
}

/*
 * If you don't have any other use for a web server, you can use this to
 * do the whole creation:
 *
 *     import { Metrics } from "crow-metrics";
 *     import { startVizServer } from "crow-metrics-viz"
 *     import express from "express";
 *
 *     var metrics = Metrics.create();
 *     startVizServer(metrics, 8080);
 */
export function startVizServer(
  metrics: Metrics,
  port: number = 8080,
  options: VizOptions = {}
) {
  const app = express();
  app.use("/", viz(metrics, options));
  app.listen(port);
}

function* flatten<A>(x: Iterable<A>[]): Iterable<A> {
  for (const iter of x) for (const item of iter) yield item;
}
