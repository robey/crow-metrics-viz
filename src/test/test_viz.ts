import * as express from "express";
import * as http from "http";
import { Metrics } from "crow-metrics";
import { viz } from "../viz";
import * as request from "supertest-as-promised";

import "should";
import "source-map-support/register";

describe("viz", () => {
  let m: Metrics;

  beforeEach(() => {
    m = Metrics.create();
  });

  afterEach(() => {
    m.registry.stop();
  });

  it("reports current values", () => {
    const app = express();
    const router = viz(m);
    app.use(router);

    m.setGauge(m.gauge("speed"), 45);
    m.increment(m.counter("bugs"), 23);
    m.addDistribution(m.distribution("tears"), 10);
    m.registry.publish();

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
    const app = express();
    const router = viz(m);
    app.use(router);

    m.setGauge(m.gauge("speed"), 45);
    m.increment(m.counter("bugs"), 23);
    m.addDistribution(m.distribution("tears"), 10);
    m.registry.publish();

    m.increment(m.counter("bugs"), 5);
    m.increment(m.counter("foo"), 10);
    m.addDistribution(m.distribution("tears"), 3);
    m.registry.publish();

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
    const app = express();
    const router = viz(m);
    app.use(router);

    m.increment(m.counter("bugs"), 23);
    m.registry.publish();
    m.increment(m.counter("bugs"), 5);
    m.registry.publish();

    return request(app).get("/debug.json").expect(200).then(response => {
      const debug = response.body;
      debug.should.eql([
        { bugs: 23 },
        { bugs: 5 }
      ]);
    });
  });
});
