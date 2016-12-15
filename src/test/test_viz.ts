import * as express from "express";
import * as http from "http";
import { MetricsRegistry } from "crow-metrics";
import { viz } from "../viz";
import * as request from "supertest-as-promised";

import "should";
import "source-map-support/register";

describe("viz", () => {
  it("reports current values", () => {
    const r = new MetricsRegistry();
    const app = express();
    const router = viz(r);
    app.use(router);

    r.setGauge(r.gauge("speed"), 45);
    r.increment(r.counter("bugs"), 23);
    r.addDistribution(r.distribution("tears"), 10);
    r.publish();

    return request(app).get("/current.json").expect(200).then(response => {
      response.body.should.eql({
        bugs: 23,
        speed: 45,
        "tears{p=0.5}": 10,
        "tears{p=0.99}": 10,
        "tears{p=0.9}": 10,
        "tears{p=count}": 1,
        "tears{p=sum}": 10
      });
    });
  });

  it("reports history", () => {
    const r = new MetricsRegistry();
    const app = express();
    const router = viz(r);
    app.use(router);

    r.setGauge(r.gauge("speed"), 45);
    r.increment(r.counter("bugs"), 23);
    r.addDistribution(r.distribution("tears"), 10);
    r.publish();

    r.increment(r.counter("bugs"), 5);
    r.increment(r.counter("foo"), 10);
    r.addDistribution(r.distribution("tears"), 3);
    r.publish();

    return request(app).get("/history.json").expect(200).then(response => {
      const history = response.body;
      Object.keys(history).sort().should.eql([
        "@timestamp", "bugs", "foo", "speed", "tears{p=0.5}", "tears{p=0.99}", "tears{p=0.9}", "tears{p=count}", "tears{p=sum}"
      ]);
      history.bugs.should.eql([ 23, 5 ]);
      history.foo.should.eql([ null, 10 ]);
      history.speed.should.eql([ 45, 45 ]);
      history["tears{p=count}"].should.eql([ 1, 1 ]);
      history["tears{p=0.5}"].should.eql([ 10, 3 ]);
    });
  });

  it("reports debugging info", () => {
    const r = new MetricsRegistry();
    const app = express();
    const router = viz(r);
    app.use(router);

    r.increment(r.counter("bugs"), 23);
    r.publish();
    r.increment(r.counter("bugs"), 5);
    r.publish();

    return request(app).get("/debug.json").expect(200).then(response => {
      const debug = response.body;
      debug.should.eql([
        { bugs: 23 },
        { bugs: 5 }
      ]);
    });
  });
});
