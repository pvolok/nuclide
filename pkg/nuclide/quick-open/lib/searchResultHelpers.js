'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

type GroupedResults = {string: {string: {items: Array<any>}}};

var {
  isEmpty
} = require('nuclide-commons').object;

function filterEmptyResults(resultsGroupedByService: GroupedResults) : GroupedResults {
  var filteredTree = {};

  for (var serviceName in resultsGroupedByService) {
    var directories = resultsGroupedByService[serviceName];
    var nonEmptyDirectories = {};
    for (var dirName in directories) {
      if (directories[dirName].items.length) {
        nonEmptyDirectories[dirName] = directories[dirName];
      }
    }
    if (!isEmpty(nonEmptyDirectories)) {
      filteredTree[serviceName] = nonEmptyDirectories;
    }
  }
  return filteredTree;
}

module.exports = {
  filterEmptyResults,
};
