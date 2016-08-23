import { WizeMongooseModel } from "wize-mongoose-model";
export declare class MongooseSchemaCRUD {
    schemaName: string;
    metaRoutes: Array<{
        url: string;
        method: string;
        handler: (request: any, response: any) => void;
    }>;
    constructor(modelObject: WizeMongooseModel);
    private createGetRoute(modelObject);
    private createGetOneRoute(modelObject);
    private createPostRoute(modelObject);
    private createPutRoute(modelObject);
    private createDeleteRoute(modelObject);
    private createGetHistoryRoute(modelObject);
    private createGetCertificationRoute(modelObject);
    private createPostCertificationRoute(modelObject);
    private createMetadataRoute(modelObject);
}
