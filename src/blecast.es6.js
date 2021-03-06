'use strict';

import Promise from 'es6-promises';
import LRU from 'lru-cache';

const TAG = '[BLECAST]'

// key = categoryName, value = category store (key = address, value = array of category hanldler info)
let peripheralsIn = {};
let unknown = LRU({
  max: 100,
  maxAge: 1000 * 60 * 60
});

/**
 * Associate the given in-Node object with the BLE module.
 * @param n the in-Node object to be registered as a BLE node
 * @param categoryName the category name
 * @param address the ble address delimited by '-'
 * @param uuid the ble identifier (optional)
 * @param parse the parse function
 * @param useString whether or not to use String type rather than JSON object as the payload format
 * @param RED the initialized RED object
 * @return void (sync)
 */
export function registerIn(n, categoryName, address, uuid, parse, useString, RED) {
  if (!n || !categoryName || !address || !parse) {
    throw new Error('Invalid node!');
  }
  if (!RED) {
    throw new Error('RED is required!!');
  }
  let category = peripheralsIn[categoryName];
  if (!category) {
    category = {};
    peripheralsIn[categoryName] = category;
  }
  let ary = [];
  if (address in category) {
    ary = category[address];
    ary = ary.filter(ele => {
      if (RED.nodes.getNode(ele.id)) {
        return (ele.id !== n.id);
      }
      return false;
    });
  }
  ary.push({
    id: n.id,
    parse: parse,
    useString: useString
  });
  category[address] = ary;
  if (uuid) {
    category[uuid] = category[address];
    RED.log.info(`${TAG} category=[${categoryName}], address=[${address}], uuid=[${uuid}], node ID=[${n.id}] has been registered.`);
  } else {
    RED.log.info(`${TAG} category=[${categoryName}], address=[${address}], node ID=[${n.id}] has been registered.`);
  }
}

export function removeIn(n, categoryName, address, uuid, RED) {
  if (!n || !categoryName || !address) {
    throw new Error('Invalid node!');
  }
  if (!RED) {
    throw new Error('RED is required!!');
  }
  let category = peripheralsIn[categoryName];
  if (!category) {
    return false;
  }
  let ary = [];
  if (address in category) {
    ary = category[address];
    ary = ary.filter(ele => {
      return (ele.id === n.id);
    });
    ary.forEach((ele) => {
      let pos = category[address].indexOf(ele);
      category[address].splice(pos, 1);
    });
    if (ary.length === 0) {
      return false;
    }
    if (uuid) {
      RED.log.info(`${TAG} category=[${categoryName}], address=[${address}], uuid=[${uuid}], node ID=[${n.id}] has been removed.`);
    } else {
      RED.log.info(`${TAG} category=[${categoryName}], address=[${address}], node ID=[${n.id}] has been removed.`);
    }
    return true;
  }
  return false;
}

export function clear(RED) {
  unknown.reset();
  RED.log.info(`${TAG} Unknown cache cleared`);
}

function anotherCategory(cat) {
  if (cat === 'BLECAST_TM') {
    return 'BLECAST_BL';
  } else {
    return 'BLECAST_TM';
  }
}

export function discoverFunc(categoryName, peripheral, RED) {
  // look up a category by the category name
  let category = peripheralsIn[categoryName];
  let anotherName = anotherCategory(categoryName);
  let another = peripheralsIn[anotherName];
  if (another) {
    if (another[peripheral.address] || another[peripheral.uuid]) {
      RED.log.warn(RED._('asakusa_giken.errors.wrong-category',
        { wrongCategory: categoryName, correctCategory: anotherName,
          peripheralAddress: peripheral.address,
          peripheralUuid: peripheral.uuid }));
      return false;
    }
  }
  if (!category) {
    let key = categoryName + ':' + peripheral.address + ':' + peripheral.uuid;
    if (!unknown.get(key)) {
      unknown.set(key, 1);
      RED.log.warn(RED._('asakusa_giken.errors.unknown-peripheral',
        { categoryName: categoryName, peripheralAddress: peripheral.address, peripheralUuid: peripheral.uuid }));
    }
    return false;
  }
  // check if the peripheral.address matches
  let address = peripheral.address;
  let uuid = null;
  let bleNodes = null;
  if (address === 'unknown') {
    uuid = peripheral.uuid;
    bleNodes = category[uuid];
    if (!bleNodes || bleNodes.length === 0) {
      let key = categoryName + ':' + uuid;
      if (!unknown.get(key)) {
        unknown.set(key, 1);
        RED.log.warn(RED._('asakusa_giken.errors.unknown-uuid',
          { categoryName: categoryName, peripheralUuid: uuid }));
      }
      return false;
    }
  }
  if (!uuid) {
    if (address.indexOf('-') >= 0) {
      address = address.replace(new RegExp('-', 'g'), ':');
    }
    bleNodes = category[address];
    if (!bleNodes || bleNodes.length === 0) {
      let key = categoryName + ':' + address;
      if (!unknown.get(key)) {
        unknown.set(key, 1);
        RED.log.warn(RED._('asakusa_giken.errors.unknown-address',
          { categoryName: categoryName, peripheralAddress: address }));
      }
      return false;
    }
  }
  // send the ble node a payload if the address exists
  let removed = false;
  let adv = peripheral.advertisement;
  bleNodes = bleNodes.filter(ele => {
    let node = RED.nodes.getNode(ele.id);
    if (!node) {
      removed = true;
      return false;
    }
    let payload = ele.parse(adv.manufacturerData);
    payload.tstamp = Date.now();
    payload.rssi = peripheral.rssi;
    payload.address = address;
    if (uuid) {
      payload.uuid = uuid;
    }
    if (ele.useString) {
      payload = JSON.stringify(payload);
    }
    node.send({'payload': payload});
    return true;
  });
  if (removed) {
    category[uuid] = bleNodes;
    if (address !== 'unknown') {
      category[address] = bleNodes;
    }
  }
  return true;
}

export function acceptFunc(categoryName) {
  return (~'BLECAST_TM BLECAST_BL'.indexOf(categoryName));
}
