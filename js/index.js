"use strict";
const mongoose_1 = require("mongoose");
const config_1 = require("./config");
const validations_1 = require("./validations");
const wize_utilities_1 = require("wize-utilities");
class MongooseSchemaCRUD {
    constructor(modelObject) {
        this.schemaName = modelObject.metadata.name;
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}`,
            method: "GET",
            handler: this.createGetRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}`,
            method: "POST",
            handler: this.createPostRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/metadata`,
            method: "GET",
            handler: this.createMetadataRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/certification`,
            method: "GET",
            handler: this.createGetCertificationRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/certification/:identifier`,
            method: "GET",
            handler: this.createGetCertificationRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/certification`,
            method: "POST",
            handler: this.createPostCertificationRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/history`,
            method: "GET",
            handler: this.createGetHistoryRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/history/:identifier`,
            method: "GET",
            handler: this.createGetHistoryRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/:_id`,
            method: "GET",
            handler: this.createGetOneRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/:_id`,
            method: "PUT",
            handler: this.createPutRoute(modelObject)
        });
        this.metaRoutes.push({
            url: `/${modelObject.metadata.name}/:_id`,
            method: "DELETE",
            handler: this.createDeleteRoute(modelObject)
        });
    }
    createGetRoute(modelObject) {
        return function (request, response) {
            let limit;
            let pageNumber;
            let columns = {};
            let populate = (request.query.association == "true");
            let sort = {};
            if (request.query.limit && isNaN(request.query.limit)) {
                return response.status(400).json({ message: "Limit parameter can only have numeric value." });
            }
            if (request.query.limit && isNaN(request.query.pageNumber)) {
                return response.status(400).json({ message: "Page number parameter can only have numeric value." });
            }
            limit = request.query.limit ? Number(request.query.limit) : config_1.config.defaultLimit;
            pageNumber = request.query.pageNumber ? Number(request.query.pageNumber) : config_1.config.pageNumber;
            populate = (request.query.association === true || request.query.association == "true");
            let columnList = request.query.columns ? String(request.query.columns).replace(/ /g, '').split(',') : [];
            for (var i of columnList) {
                columns[i] = 1;
            }
            let sortObject = request.query.sort ? validations_1.isValidJSON(request.query.sort) : {};
            if (!sortObject) {
                return response.status(400).json({ message: "Invalid value for sort parameter" });
            }
            else {
                sort = sortObject;
            }
            let userRole = [];
            if (request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess = validations_1.isAccessible(userRole, modelObject.metadata.readRoles);
            for (var _column of modelObject.metadata.columns) {
                if (columnList.length > 0) {
                    if (columns[_column.name] && !_column.isAvailable) {
                        delete columns[_column.name];
                    }
                    else if (columns[_column.name] && !validations_1.isAccessible(userRole, _column.readRoles)) {
                        delete columns[_column.name];
                    }
                }
                else if (_column.isAvailable && validations_1.isAccessible(userRole, _column.readRoles)) {
                    columns[_column.name] = 1;
                }
            }
            if (schemaAccess) {
                let where = request.query.where ? validations_1.isValidJSON(request.query.where) : { value: {} };
                if (!where) {
                    return response.status(400).json({ message: "Invalid value for where parameter" });
                }
                let options = {
                    limit: limit,
                    skip: (pageNumber - 1) * limit,
                    sort: sort
                };
                console.log('Getting List with options: ', options);
                let query = modelObject.model.find(where, columns, options);
                if (populate) {
                    let refs = modelObject.metadata.columns.filter((_column) => ['Ref_Many', 'Ref_One'].indexOf(_column.type) > -1).map(_column => _column.name);
                    if (refs && refs.length > 0) {
                        query = query.populate(refs.join(" "));
                    }
                }
                query.lean().exec((error, records) => {
                    if (error) {
                        console.log(error);
                        response.status(500).json({ message: error.message });
                    }
                    else {
                        modelObject.model.count(where, (error, count) => {
                            if (error) {
                                console.log(error);
                                response.status(500).json({ message: error.message });
                            }
                            else {
                                response.status(200).json({
                                    records: records, total: count
                                });
                            }
                        });
                    }
                });
            }
            else {
                response.status(403).json({ message: "Unauthorized Access" });
            }
        };
    }
    createGetOneRoute(modelObject) {
        return function (request, response) {
            let _id = request.params._id;
            if (!new mongoose_1.Types.ObjectId(_id).isValid()) {
                return response.status(400).json(_id + " is not valid id");
            }
            let columns = {};
            let populate = (request.query.association == "true");
            let columnList = request.query.columns ? String(request.query.columns).replace(/ /g, '').split(',') : [];
            for (let _column of columnList) {
                columns[_column] = 1;
            }
            let userRole = [];
            if (request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess = validations_1.isAccessible(userRole, modelObject.metadata.readRoles);
            for (var _column of modelObject.metadata.columns) {
                if (columnList.length > 0) {
                    if (columns[_column.name] && !_column.isAvailable) {
                        delete columns[_column.name];
                    }
                    else if (columns[_column.name] && !validations_1.isAccessible(userRole, _column.readRoles)) {
                        delete columns[_column.name];
                    }
                }
                else if (_column.isAvailable && validations_1.isAccessible(userRole, _column.readRoles)) {
                    columns[_column.name] = 1;
                }
            }
            if (schemaAccess) {
                var query = modelObject.model.findById(_id, columns);
                if (populate) {
                    let refs = modelObject.metadata.columns.filter(_column => ['Ref_Many', 'Ref_One'].indexOf(_column.type) > -1).map(_column => _column.name);
                    if (refs && refs.length > 0) {
                        query = query.populate(refs.join(" "));
                    }
                }
                query.exec((error, document) => {
                    if (error) {
                        console.log(error);
                        response.status(500).json({ message: error.message });
                    }
                    else {
                        response.status(200).json(document);
                    }
                });
            }
            else {
                response.status(403).json({ message: "Unauthorized Access" });
            }
        };
    }
    createPostRoute(modelObject) {
        return function (request, response) {
            let requestBody = request.body;
            let newDocument = new modelObject.model(requestBody);
            let userRole = [];
            if (request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess = validations_1.isAccessible(userRole, modelObject.metadata.createRoles);
            if (schemaAccess) {
                newDocument.save((error, result) => {
                    if (error) {
                        console.log(error);
                        if (error.code == 11000) {
                            response.status(500).json({
                                message: error.message,
                                document: newDocument
                            });
                        }
                        else {
                            response.status(500).json({ message: error.message });
                        }
                    }
                    else if (modelObject.metadata.versioning == true) {
                        let diffObject = { changed: 'created', value: result };
                        new modelObject.historyModel({
                            diff: diffObject,
                            identifier: result._id,
                            email: request.user ? request.user.email : ''
                        }).save((err, newVersion) => {
                            response.status(200).json(newDocument);
                        });
                    }
                    else {
                        response.status(200).json(newDocument);
                    }
                });
            }
            else {
                response.status(403).json({ message: "Unauthorized Access" });
            }
        };
    }
    createPutRoute(modelObject) {
        return function (request, response) {
            let _id = request.params._id;
            if (!new mongoose_1.Types.ObjectId(_id).isValid()) {
                return response.status(400).json(_id + " is not valid id");
            }
            var updatedApiFields = request.body;
            if (updatedApiFields._id) {
                delete updatedApiFields._id;
            }
            let userRole = [];
            if (request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess = validations_1.isAccessible(userRole, modelObject.metadata.updateRoles);
            for (var i in modelObject.metadata.columns) {
                var _column = modelObject.metadata.columns[i];
                if (updatedApiFields[_column.name] && !validations_1.isAccessible(userRole, _column.updateRoles)) {
                    delete updatedApiFields[_column.name];
                }
            }
            if (schemaAccess) {
                updatedApiFields['updatedAt'] = new Date();
                modelObject.model.findById(_id, (error, record) => {
                    if (error) {
                        console.log(error);
                        return response.status(500).json({ message: error.message });
                    }
                    else {
                        if (!record) {
                            console.log('No Record Found with _id', _id);
                            response.status(400).json({
                                message: 'No Record Found'
                            });
                        }
                        else {
                            let _oldData = Object.assign({}, record.toJSON());
                            for (let key in updatedApiFields) {
                                record[key] = updatedApiFields[key];
                            }
                            record.save((error) => {
                                if (error) {
                                    console.log(error);
                                    return response.status(500).json({ message: error.message });
                                }
                                else {
                                    if (modelObject.metadata.versioning == true) {
                                        delete record["_id"];
                                        delete updatedApiFields['updatedAt'];
                                        let _newData = Object.assign({}, record.toJSON());
                                        for (var i in _oldData) {
                                            if (updatedApiFields[i] === undefined) {
                                                delete _oldData[i];
                                                delete _newData[i];
                                            }
                                        }
                                        let diffObject = wize_utilities_1.objectDiff(_oldData, _newData);
                                        if (diffObject.changed != "equal") {
                                            new modelObject.historyModel({
                                                diff: diffObject,
                                                identifier: _id,
                                                email: request.user ? request.user.email : ''
                                            }).save((err, newVersion) => {
                                                response.status(200).json({
                                                    message: 'Record Updated Successfully.'
                                                });
                                            });
                                        }
                                    }
                                    else {
                                        response.status(200).json({
                                            message: 'Record Updated Successfully.'
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            }
            else {
                response.status(403).json({ message: "Unauthorized Access" });
            }
        };
    }
    createDeleteRoute(modelObject) {
        return function (request, response) {
            let _id = request.params._id;
            if (!new mongoose_1.Types.ObjectId(_id).isValid()) {
                return response.status(400).json(_id + " is not valid id");
            }
            let userRole = [];
            if (request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess = validations_1.isAccessible(userRole, modelObject.metadata.deleteRoles);
            if (schemaAccess) {
                modelObject.model.findOne({ _id: _id }).lean().exec((error, record) => {
                    if (error) {
                        console.log(error);
                        response.status(500).json({ message: error.message });
                    }
                    modelObject.model.remove({ _id: _id }, (error) => {
                        if (error) {
                            console.log(error);
                            response.status(500).json({ message: error.message });
                        }
                        else if (modelObject.metadata.versioning == true) {
                            let diffObject = { changed: 'removed', value: record };
                            new modelObject.historyModel({
                                diff: diffObject,
                                identifier: record._id,
                                email: request.user ? request.user.email : ''
                            }).save((err, newVersion) => {
                                response.status(200).json({ message: 'Record Removed with _id ' + _id });
                            });
                        }
                        else {
                            response.status(200).json({ message: 'Record Removed with _id ' + _id });
                        }
                    });
                });
            }
            else {
                response.status(403).json({ message: "Unauthorized Access" });
            }
        };
    }
    createGetHistoryRoute(modelObject) {
        return function (request, response) {
            let identifier = request.params.identifier;
            if (identifier && !new mongoose_1.Types.ObjectId(identifier).isValid()) {
                return response.status(400).json(identifier + " is not valid id");
            }
            if (modelObject.metadata.versioning) {
                let limit;
                let pageNumber;
                let populate = (request.query.association == "true");
                let dateFrom = request.query.dateFrom ? request.query.dateFrom : "";
                let dateTo = request.query.dateTo ? request.query.dateTo : "";
                let query = dateFrom || dateTo ? { createdAt: {} } : {};
                if (request.query.limit && isNaN(request.query.limit)) {
                    return response.status(400).json({ message: "Limit parameter can only have numeric value." });
                }
                if (request.query.limit && isNaN(request.query.pageNumber)) {
                    return response.status(400).json({ message: "Page number parameter can only have numeric value." });
                }
                limit = request.query.limit ? Number(request.query.limit) : config_1.config.defaultLimit;
                pageNumber = request.query.pageNumber ? Number(request.query.pageNumber) : config_1.config.pageNumber;
                populate = (request.query.association === true || request.query.association == "true");
                if (query['createdAt']) {
                    query['createdAt'] = dateFrom ? { $gte: dateFrom } : {};
                    if (dateTo) {
                        query['createdAt']['$lte'] = dateTo;
                    }
                }
                if (identifier) {
                    query['identifier'] = identifier;
                }
                let sort = {};
                let sortObject = request.query.sort ? validations_1.isValidJSON(request.query.sort) : {};
                if (!sortObject) {
                    return response.status(400).json({ message: "Invalid value for sort parameter" });
                }
                else {
                    sort = sortObject;
                }
                let options = {
                    limit: limit,
                    skip: (pageNumber - 1) * limit,
                    sort: sort
                };
                let populateFields = request.query.populateColumns ? String(request.query.populateColumns).replace(/ /g, '').replace(/,/g, ' ') : undefined;
                var mongoQuery = modelObject.historyModel.find(query, { _id: 0 }, options);
                if (populate) {
                    mongoQuery = mongoQuery.populate("identifier", populateFields);
                }
                mongoQuery.lean().exec((error, history) => {
                    if (error) {
                        console.log(error);
                        return response.status(500).json({ message: error.message });
                    }
                    else {
                        modelObject.historyModel.count(query, (error, count) => {
                            if (error) {
                                console.log(error);
                                response.status(500).json({ message: error.message });
                            }
                            else {
                                response.status(200).json({
                                    records: history, total: count
                                });
                            }
                        });
                    }
                });
            }
            else {
                response.status(404).json({ message: "Not Found" });
            }
        };
    }
    createGetCertificationRoute(modelObject) {
        return function (request, response) {
            let identifier = request.params.identifier;
            if (identifier && !new mongoose_1.Types.ObjectId(identifier).isValid()) {
                return response.status(400).json(identifier + " is not valid id");
            }
            if (modelObject.metadata.certification) {
                let limit;
                let pageNumber;
                let populate = (request.query.association == "true");
                let dateFrom = request.query.dateFrom ? request.query.dateFrom : "";
                let dateTo = request.query.dateTo ? request.query.dateTo : "";
                let query = dateFrom || dateTo ? { createdAt: {} } : {};
                if (request.query.limit && isNaN(request.query.limit)) {
                    return response.status(400).json({ message: "Limit parameter can only have numeric value." });
                }
                if (request.query.limit && isNaN(request.query.pageNumber)) {
                    return response.status(400).json({ message: "Page number parameter can only have numeric value." });
                }
                limit = request.query.limit ? Number(request.query.limit) : config_1.config.defaultLimit;
                pageNumber = request.query.pageNumber ? Number(request.query.pageNumber) : config_1.config.pageNumber;
                populate = (request.query.association === true || request.query.association == "true");
                if (query['createdAt']) {
                    query['createdAt'] = dateFrom ? { $gte: dateFrom } : {};
                    if (dateTo) {
                        query['createdAt']['$lte'] = dateTo;
                    }
                }
                if (identifier) {
                    query['identifier'] = identifier;
                }
                let sort = {};
                let sortObject = request.query.sort ? validations_1.isValidJSON(request.query.sort) : {};
                if (!sortObject) {
                    return response.status(400).json({ message: "Invalid value for sort parameter" });
                }
                else {
                    sort = sortObject;
                }
                let options = {
                    limit: limit,
                    skip: (pageNumber - 1) * limit,
                    sort: sort
                };
                let populateFields = request.query.populateColumns ? String(request.query.populateColumns).replace(/ /g, '').replace(/,/g, ' ') : undefined;
                var mongoQuery = modelObject.certificationModel.find(query, { _id: 0 }, options);
                if (populate) {
                    mongoQuery = mongoQuery.populate("identifier", populateFields);
                }
                mongoQuery.lean().exec((error, certification) => {
                    if (error) {
                        console.log(error);
                        return response.status(500).json({ message: error.message });
                    }
                    else {
                        modelObject.certificationModel.count(query, (error, count) => {
                            if (error) {
                                console.log(error);
                                response.status(500).json({ message: error.message });
                            }
                            else {
                                response.status(200).json({
                                    records: certification, total: count
                                });
                            }
                        });
                    }
                });
            }
            else {
                response.status(404).json({ message: "Not Found" });
            }
        };
    }
    createPostCertificationRoute(modelObject) {
        return function (request, response) {
            let requestBody = request.body;
            let newDocument = new modelObject.certificationModel(requestBody);
            newDocument.save((error) => {
                if (error) {
                    console.log(error);
                    if (error.code == 11000) {
                        response.status(500).json({
                            message: error.message,
                            document: newDocument
                        });
                    }
                    else {
                        response.status(500).json({ message: error.message });
                    }
                }
                else {
                    response.status(200).json(newDocument);
                }
            });
        };
    }
    createMetadataRoute(modelObject) {
        return function (request, response) {
            response.status(200).json(modelObject.metadata);
        };
    }
}
exports.MongooseSchemaCRUD = MongooseSchemaCRUD;
//# sourceMappingURL=index.js.map