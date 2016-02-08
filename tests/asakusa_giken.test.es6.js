'use strict';

import * as sinon from 'sinon';
import { assert } from 'chai';
import RED from 'node-red';
import asakusaGikenModule from '../lib/asakusa_giken';
import * as ble from '../lib/ble';

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('asakusa_giken node', () => {
  RED.debug = true;
	let sandbox;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
    RED._ = sinon.spy();
	});
	afterEach(() => {
		sandbox = sandbox.restore();
	});
  describe('asakusa_giken module', () => {
    it('should have valid Node-RED plugin classes', done => {
      assert.isNotNull(RED);
      asakusaGikenModule(RED).then(() => {
        assert.isNotNull(RED.nodes.getType('BLECAST_BL').name);
        assert.isNotNull(RED.nodes.getType('BLECAST_BL in').name);
        assert.isNotNull(RED.nodes.getType('BLECAST_TM').name);
        assert.isNotNull(RED.nodes.getType('BLECAST_TM in').name);
        ble.stop(RED);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});
