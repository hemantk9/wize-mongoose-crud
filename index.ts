import { Query as MongooseQuery, Document, Types as MongooseTypes } from "mongoose";
import { WizeMongooseModel } from "wize-mongoose-model";
import { WizeColumn} from "wize-schema";
import { config } from "./config";
import { isValidJSON, isAccessible } from "./validations";
import { objectDiff } from "wize-utilities";
import * as pluralize from "pluralize";
//TODO: Use pluralize in routes

export class MongooseSchemaCRUD {
    public schemaName: string;
    public metaRoutes: Array<{
        url: string,
        method: string,
        handler: (request: any, response: any)=> void
    }>;
    constructor(modelObject: WizeMongooseModel) {
        this.schemaName = modelObject.metadata.name
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
    private createGetRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            let limit: number;
            let pageNumber:number;
            let columns: any = {};
            let populate: boolean = (request.query.association == "true");
            let sort: Object = {};
            if (request.query.limit && isNaN(request.query.limit)) {
                return response.status(400).json({message: "Limit parameter can only have numeric value."});
            }
            if (request.query.limit && isNaN(request.query.pageNumber)) {
                return response.status(400).json({message: "Page number parameter can only have numeric value."});
            }
            limit = request.query.limit ? Number(request.query.limit) : config.defaultLimit;
            pageNumber = request.query.pageNumber ? Number(request.query.pageNumber) : config.pageNumber;
            populate = (request.query.association === true  || request.query.association == "true");
            let columnList: Array<string> = request.query.columns ? String(request.query.columns).replace(/ /g, '').split(',') : [];
            for (var i of columnList) {
                columns[i] = 1;
            }
            let sortObject = request.query.sort ? isValidJSON(request.query.sort) : {};
            if (!sortObject) {
                 return response.status(400).json({message: "Invalid value for sort parameter"});
            } else {
                sort = sortObject;
            }
            let userRole: string[] = [];
            if(request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess: boolean = isAccessible(userRole, modelObject.metadata.readRoles);
            for (var _column of modelObject.metadata.columns) {
                if (columnList.length > 0) {
                    if (columns[_column.name] && !_column.isAvailable) {
                        delete columns[_column.name];
                    } else if (columns[_column.name] && !isAccessible(userRole, _column.readRoles)) {
                        delete columns[_column.name];
                    }
                } else if (_column.isAvailable && isAccessible(userRole, _column.readRoles)) {
                    columns[_column.name] = 1;
                }
            }
            if (schemaAccess) {
                // Create the final query based on above criteria and run the query to send the response.
                let where = request.query.where ? isValidJSON(request.query.where) : {value: {}};
                if (!where) {
                    return response.status(400).json({message: "Invalid value for where parameter"});
                }
                let options = {
                    limit: limit,
                    skip: (pageNumber - 1) * limit,
                    sort: sort
                };
                console.log('Getting List with options: ', options);
                let query: MongooseQuery<{}> = modelObject.model.find(where, columns, options);

                // This populates all the columns which have any kind of association with other schemas.
                if (populate) {
                    let refs = modelObject.metadata.columns.filter((_column: WizeColumn) => ['Ref_Many', 'Ref_One'].indexOf(_column.type)> -1).map(_column=> _column.name);
                    if (refs && refs.length > 0) {
                        query = query.populate(refs.join(" "));
                    }
                }
                query.lean().exec((error, records) => {
                    if (error) {
                        console.log(error);
                        response.status(500).json({message: error.message});
                    } else {
                        modelObject.model.count(where, (error, count) => {
                            if (error) {
                                console.log(error);
                                response.status(500).json({message: error.message});
                            } else {
                                response.status(200).json({
                                    records: records, total: count
                                });
                            }
                        });
                    }
                });
            } else {
                response.status(403).json({message: "Unauthorized Access"});
            }
        }
    }
    private createGetOneRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            let _id: string = request.params._id;
            if (!new MongooseTypes.ObjectId(_id).isValid()) {
                return response.status(400).json(_id + " is not valid id");
            }
            let columns: any = {};
            // This populates all the columns which have any kind of association with other schemas.
                let populate = (request.query.association == "true");
            // This applies projections supplied by the user to the query for getting selective columns in the response.
            let columnList: Array<string> = request.query.columns ? String(request.query.columns).replace(/ /g, '').split(',') : [];
            for (let _column of columnList) {
                columns[_column] = 1;
            }
            // This checks the schema access of the user based on user role.
            let userRole: string[] = [];
            if(request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess: boolean = isAccessible(userRole, modelObject.metadata.readRoles);
            // columns that will be sent in response based on user role field access and isAvailable flag.
            for (var _column of modelObject.metadata.columns) {
                if (columnList.length > 0) {
                    if (columns[_column.name] && !_column.isAvailable) {
                        delete columns[_column.name];
                    } else if (columns[_column.name] && !isAccessible(userRole, _column.readRoles)) {
                        delete columns[_column.name];
                    }
                } else if (_column.isAvailable && isAccessible(userRole, _column.readRoles)) {
                    columns[_column.name] = 1;
                }
            }

            if (schemaAccess) {
                var query: MongooseQuery<{}> = modelObject.model.findById(_id, columns);
                if (populate) {
                    let refs = modelObject.metadata.columns.filter(_column => ['Ref_Many', 'Ref_One'].indexOf(_column.type)> -1).map(_column=> _column.name);
                    if (refs && refs.length > 0) {
                        query = query.populate(refs.join(" "));
                    }
                }
                query.exec((error, document) => {
                    if (error) {
                        console.log(error);
                        response.status(500).json({message: error.message});
                    } else {
                        response.status(200).json(document);
                    }
                });
            } else {
                response.status(403).json({message: "Unauthorized Access"});
            }
        }
    }
    private createPostRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            // The actual model object to be saved in the db.
            let requestBody = request.body;
            let newDocument = new modelObject.model(requestBody);

            // This checks the schema access of the user based on user role.
            let userRole: string[] = [];
            if(request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess: boolean = isAccessible(userRole, modelObject.metadata.createRoles);
            if (schemaAccess) {
                // Saving the document in the database
                newDocument.save((error: any, result: Document) => {
                    if (error) {
                        console.log(error);
                        if (error.code == 11000) {
                            response.status(500).json({
                                message: error.message,
                                document: newDocument
                            });
                        } else {
                            response.status(500).json({message: error.message});
                        }
                    } else if (modelObject.metadata.versioning == true) {
                        let diffObject = { changed: 'created', value: result};
                            new modelObject.historyModel({
                                diff: diffObject,
                                identifier: result._id,
                                email: request.user ? request.user.email : ''
                            }).save((err, newVersion)=> {
                                response.status(200).json(newDocument);
                            });
                    } else {
                        response.status(200).json(newDocument);
                    }
                });
            } else {
                response.status(403).json({message: "Unauthorized Access"});
            }
        }
    }
    private createPutRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            // This checks whether the id passed a param is a valid mongo db id or not.
            let _id: string = request.params._id;
            if (!new MongooseTypes.ObjectId(_id).isValid()) {
                return response.status(400).json(_id + " is not valid id");
            }
            // update request
            var updatedApiFields = request.body;
            if (updatedApiFields._id) {
                delete updatedApiFields._id;
            }
        
            // This checks the schema access of the user based on user role.
            let userRole: string[] = [];
            if(request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess: boolean = isAccessible(userRole, modelObject.metadata.updateRoles);
            // This checks the field level write access rights for the user and if user is not allowed to
            // update a field, it is deleted from the request.
            for (var i in modelObject.metadata.columns) {
                var _column = modelObject.metadata.columns[i];
                if (updatedApiFields[_column.name] && !isAccessible(userRole, _column.updateRoles)) {
                    delete updatedApiFields[_column.name];
                }
            }

            if (schemaAccess) {
                // Update 'updatedAt' for this entity
                updatedApiFields['updatedAt'] = new Date();
                // Create the final query based on above criteria and run the query to update the model data.
                modelObject.model.findById(_id, (error: any, record: any)=>{
                    if(error){
                        console.log(error);
                        return response.status(500).json({message: error.message});
                    } else {
                        if (!record) {
                            console.log('No Record Found with _id', _id);
                            response.status(400).json({
                                message: 'No Record Found'
                            });
                        } else {
                            let _oldData = Object.assign({}, record.toJSON());
                            for (let key in updatedApiFields) {
                                record[key] = updatedApiFields[key];
                            }
                            record.save((error: any)=> {
                                if (error) {
                                    console.log(error);
                                    return response.status(500).json({message: error.message});
                                } else {
                                    // If model data versioning is enabled, then get the diff between the old and new data and
                                    // save it in the versioning schema of the model.
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
                                        let diffObject = objectDiff(_oldData, _newData);
                                        if (diffObject.changed != "equal") {
                                            new modelObject.historyModel({
                                                diff: diffObject,
                                                identifier: _id,
                                                email: request.user ? request.user.email : ''
                                            }).save((err, newVersion)=> {
                                                response.status(200).json({
                                                    message: 'Record Updated Successfully.'
                                                });
                                            });
                                        }
                                    } else {
                                        response.status(200).json({
                                            message: 'Record Updated Successfully.'
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            } else {
                response.status(403).json({message: "Unauthorized Access"});
            }
        }
    }
    private createDeleteRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            let _id: string = request.params._id;
            if (!new MongooseTypes.ObjectId(_id).isValid()) {
                return response.status(400).json(_id + " is not valid id");
            }
            // This checks the schema access of the user based on user role.
            let userRole: string[] = [];
            if(request.user && request.user.roles) {
                userRole = request.user.roles;
            }
            let schemaAccess: boolean = isAccessible(userRole, modelObject.metadata.deleteRoles);

            if (schemaAccess) {
                // This creates a actual query to delete the model object.
                modelObject.model.findOne({_id: _id}).lean().exec((error, record)=> {
                    if (error) {
                        console.log(error);
                        response.status(500).json({message: error.message});
                    }
                    modelObject.model.remove({_id: _id}, (error) => { // Second parameter result is not added in typings
                        if (error) {
                            console.log(error);
                            response.status(500).json({message: error.message});
                        } else if (modelObject.metadata.versioning == true) {
                            let diffObject = { changed: 'removed', value: record};
                                new modelObject.historyModel({
                                    diff: diffObject,
                                    identifier: record._id,
                                    email: request.user ? request.user.email : ''
                                }).save((err, newVersion)=> {
                                    response.status(200).json({message: 'Record Removed with _id ' + _id});
                                });
                        } else {
                            response.status(200).json({message: 'Record Removed with _id ' + _id});
                        }
                    });
                });
            } else {
                response.status(403).json({message: "Unauthorized Access"});
            }
        }
    }
    private createGetHistoryRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            // This checks whether the identifier passed as param is a valid mongo db id or not.
            let identifier: string = request.params.identifier;
            if (identifier && !new MongooseTypes.ObjectId(identifier).isValid()) {
                return response.status(400).json(identifier + " is not valid id");
            }
            if (modelObject.metadata.versioning) {
                let limit: number;
                let pageNumber:number;
                let populate: boolean = (request.query.association == "true");
                    // set the date from filter to get the history of model data.
                let dateFrom = request.query.dateFrom ? request.query.dateFrom : "";
                // set the date to filter to get the history of model data.
                let dateTo = request.query.dateTo ? request.query.dateTo : "";
                let query: any = dateFrom || dateTo ? {createdAt: {}} : {};

                // set the limit of records and page number to implement pagination.
                // This applies the limit parameter to the query if passed.
                if (request.query.limit && isNaN(request.query.limit)) {
                return response.status(400).json({message: "Limit parameter can only have numeric value."});
                }
                if (request.query.limit && isNaN(request.query.pageNumber)) {
                    return response.status(400).json({message: "Page number parameter can only have numeric value."});
                }
                limit = request.query.limit ? Number(request.query.limit) : config.defaultLimit;
                pageNumber = request.query.pageNumber ? Number(request.query.pageNumber) : config.pageNumber;
                populate = (request.query.association === true  || request.query.association == "true");
                if (query['createdAt']) {
                    query['createdAt'] = dateFrom ? {$gte: dateFrom} : {};
                    if (dateTo) {
                        query['createdAt']['$lte'] = dateTo;
                    }
                }
                if (identifier) {
                    query['identifier'] = identifier;
                }
                let sort = {};
                let sortObject = request.query.sort ? isValidJSON(request.query.sort) : {};
                if (!sortObject) {
                    return response.status(400).json({message: "Invalid value for sort parameter"});
                } else {
                    sort = sortObject;
                }
                let options = {
                    limit: limit,
                    skip: (pageNumber - 1) * limit,
                    sort: sort
                };

                // Create the final query and run to get the response.
                let populateFields = request.query.populateColumns ? String(request.query.populateColumns).replace(/ /g, '').replace(/,/g, ' ') : undefined;
                var mongoQuery: MongooseQuery<{}> = modelObject.historyModel.find(query, {_id: 0}, options);
                if (populate) {
                    mongoQuery = mongoQuery.populate("identifier", populateFields);
                }
                mongoQuery.lean().exec((error, history) => {
                    if (error) {
                        console.log(error);
                        return response.status(500).json({message: error.message});
                    } else {
                        modelObject.historyModel.count(query, (error, count) => {
                            if (error) {
                                console.log(error);
                                response.status(500).json({message: error.message});
                            } else {
                                response.status(200).json({
                                    records: history, total: count
                                });
                            }
                        });
                    }
                });
            } else {
                response.status(404).json({message: "Not Found"});
            }
        }
    }
    private createGetCertificationRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            // This checks whether the identifier passed as param is a valid mongo db id or not.
            let identifier: string = request.params.identifier;
            if (identifier && !new MongooseTypes.ObjectId(identifier).isValid()) {
                return response.status(400).json(identifier + " is not valid id");
            }
            if (modelObject.metadata.certification) {
                // set the date from filter to get the history of model data.
                let limit: number;
                let pageNumber:number;
                let populate: boolean = (request.query.association == "true");
                    // set the date from filter to get the history of model data.
                let dateFrom = request.query.dateFrom ? request.query.dateFrom : "";
                // set the date to filter to get the history of model data.
                let dateTo = request.query.dateTo ? request.query.dateTo : "";
                let query: any = dateFrom || dateTo ? {createdAt: {}} : {};

                // set the limit of records and page number to implement pagination.
                // This applies the limit parameter to the query if passed.
                if (request.query.limit && isNaN(request.query.limit)) {
                return response.status(400).json({message: "Limit parameter can only have numeric value."});
                }
                if (request.query.limit && isNaN(request.query.pageNumber)) {
                    return response.status(400).json({message: "Page number parameter can only have numeric value."});
                }
                limit = request.query.limit ? Number(request.query.limit) : config.defaultLimit;
                pageNumber = request.query.pageNumber ? Number(request.query.pageNumber) : config.pageNumber;
                populate = (request.query.association === true  || request.query.association == "true");
                if (query['createdAt']) {
                    query['createdAt'] = dateFrom ? {$gte: dateFrom} : {};
                    if (dateTo) {
                        query['createdAt']['$lte'] = dateTo;
                    }
                }
                if (identifier) {
                    query['identifier'] = identifier;
                }
                let sort = {};
                let sortObject = request.query.sort ? isValidJSON(request.query.sort) : {};
                if (!sortObject) {
                    return response.status(400).json({message: "Invalid value for sort parameter"});
                } else {
                    sort = sortObject;
                }
                let options = {
                    limit: limit,
                    skip: (pageNumber - 1) * limit,
                    sort: sort
                };

                // Create the final query and run to get the response.
                let populateFields = request.query.populateColumns ? String(request.query.populateColumns).replace(/ /g, '').replace(/,/g, ' ') : undefined;
                var mongoQuery = modelObject.certificationModel.find(query, {_id: 0}, options);
                if (populate) {
                    mongoQuery = mongoQuery.populate("identifier", populateFields);
                }
                mongoQuery.lean().exec((error, certification) => {
                    if (error) {
                        console.log(error);
                        return response.status(500).json({message: error.message});
                    } else {
                        modelObject.certificationModel.count(query, (error, count) => {
                            if (error) {
                                console.log(error);
                                response.status(500).json({message: error.message});
                            } else {
                                response.status(200).json({
                                    records: certification, total: count
                                });
                            }
                        });
                    }
                });
            } else {
                response.status(404).json({message: "Not Found"});
            }
        }
    }
    private createPostCertificationRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            // The actual model object to be saved in the db.
            let requestBody = request.body;
            let newDocument = new modelObject.certificationModel(requestBody);
            // Saving the document in the database
            newDocument.save((error) => {
                if (error) {
                    console.log(error);
                    if (error.code == 11000) {
                        response.status(500).json({
                            message: error.message,
                            document: newDocument
                        });
                    } else {
                        response.status(500).json({message: error.message});
                    }
                } else {
                    response.status(200).json(newDocument);
                }
            });
        }
    }
    private createMetadataRoute(modelObject: WizeMongooseModel) : (request: any, response: any)=> void {
        return function(request, response) {
            response.status(200).json(modelObject.metadata);
        }
    }
}