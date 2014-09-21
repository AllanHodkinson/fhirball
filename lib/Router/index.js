var Promise = require('bluebird');
var express = require('express');
var ValueSetDictionary = require('../SchemaFactory/ValueSetDictionary');
var SchemaFactory = require('../SchemaFactory/index');
var ModelFactory = require('../ModelFactory/index');
var RouteFactory = require('../RouteFactory/index');
var async = require('async');

var Router = function (conformance, profiles_path, valuesets_path) {
    if (!conformance) {
        throw new Error('conformance undefined');
    }

    if (!profiles_path) {
        throw new Error('profiles_path undefined');
    }

    if (!valuesets_path) {
        throw new Error('valuesets_path undefined');
    }

    var valueSetDictionary = new ValueSetDictionary();
    var schemaFactory = new SchemaFactory();
    var modelFactory = new ModelFactory();
    var routeFactory = new RouteFactory();
    var api = express.Router();
    api.get('/', routeFactory.makeConformance(conformance));
    api.get('/metadata', routeFactory.makeConformance(conformance));

    function parseResource(resource, callback) {
        function getProfilePath(callback) {
            var profile = profiles_path + '/' + resource.type.toLowerCase() + '.profile.xml';
            callback(null, profile);
        }

        function makeSchema(profile, callback) {
            schemaFactory.make(profile, valueSetDictionary)
                .then(function (schema) {
                    callback(null, schema);
                })
                .catch(function (err) {
                    callback(err);
                });
        }

        function makeModel(schema, callback) {
            modelFactory.make(resource.type, schema)
                .then(function (model) {
                    callback(null, model);
                })
                .catch(function (err) {
                    callback(err);
                });
        }

        function parseOperation(model, callback) {
            async.map(resource.operation, function (operation, callback) {
                var route = routeFactory.make(model, operation.code);
                if (operation.code === 'read') {
                    api.get('/' + resource.type + '/:id', route);
                }

                if (operation.code === 'update') {
                    api.put('/' + resource.type + '/:id', route);
                }

                if (operation.code === 'delete') {
                    api.delete('/' + resource.type + '/:id', route);
                }

                if (operation.code === 'create') {
                    api.post('/' + resource.type, route);
                }

                if (operation.code === 'search-type') {
                    api.get('/' + resource.type, route);
                    api.get('/' + resource.type + '/_search', route);
                }

                callback(null);
            }, callback);
        }

        async.waterfall([
            getProfilePath,
            makeSchema,
            makeModel,
            parseOperation
        ], callback);
    }

    function parseRest(rest, callback) {
        if (rest.mode === 'server') {
            async.map(rest.resource, parseResource, callback);
        }
    }

    async.waterfall([
            function (callback) {
                valueSetDictionary.load(valuesets_path)
                    .then(function () {
                        async.map(conformance.rest, parseRest, function (err) {
                            if (err) return callback(err);
                        });
                    })
            }],
        function (err) {
            if (err) return
            throw(err);
        }
    );

    return api;
};

module.exports = exports = Router;