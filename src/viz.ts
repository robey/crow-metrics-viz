import * as path from "path";
import { deltaSnapshots, MetricsRegistry, RingBuffer, RingBufferOptions } from "crow-metrics";
import * as express from "express";

// find our static folder -> ./lib/crow/viz/viz.js -> ./static
const staticPath = path.resolve(require.resolve(".."), "../../static");

export interface VizOptions extends RingBufferOptions {

}

/*
 * Create a sub-path on your existing web server for displaying per-server
 * metrics:
 *
 *     import { MetricsRegistry } from "crow-metrics";
 *     import { viz } from "crow-metrics-viz";
 *     import express from "express";
 *
 *     const app = express();
 *     const metrics = new MetricsRegistry();
 *     app.use("/viz", viz(metrics));
 *     app.listen(8080);
 *
 * You can place it at any path you want.
 */
export function viz(registry: MetricsRegistry, options: VizOptions = {}): express.Router {
  const router = express.Router();
  router.use("/", express.static(staticPath));

  const ringBuffer = new RingBuffer(options);
  registry.events.map(deltaSnapshots()).attach(ringBuffer);

  router.get("/history.json", (request, response) => {
    const records = ringBuffer.get();
    const nameSet = new Set<string>();
    records.forEach(record => {
      for (const name of record.flatten().keys()) nameSet.add(name);
    });
    const names = Array.from(nameSet).sort();

    const json: { [key: string]: (number | null)[] } = { "@timestamp": [] };
    names.forEach(name => json[name] = []);

    records.forEach(record => {
      const seen = new Set<string>();
      json["@timestamp"].push(record.timestamp);
      for (const [ name, value ] of record.flatten()) {
        seen.add(name);
        json[name].push(value);
      }
      names.forEach(name => {
        if (!seen.has(name)) json[name].push(null);
      });
    });

    response.type("json");
    response.send(json);
  });

  router.get("/debug.json", (request, response) => {
    const records = ringBuffer.get();

    response.type("json");
    response.send(records.map(record => record.toJson()));
  });

  router.get("/current.json", (request, response) => {
    const latest = ringBuffer.getLatest();
    response.type("json");
    response.send(latest ? latest.toJson() : {});
  });

  return router;
}

/*
 * If you don't have any other use for a web server, you can use this to
 * do the whole creation:
 *
 *     import { MetricsRegistry, startVizServer } from "crow-metrics";
 *     import express from "express";
 *
 *     var metrics = new MetricsRegistry();
 *     startVizServer(express, metrics);
 */
export function startVizServer(
  registry: MetricsRegistry,
  port: number = 8080,
  options: VizOptions = {}
) {
  const app = express();
  app.use("/", viz(registry, options));
  app.listen(port);
}
