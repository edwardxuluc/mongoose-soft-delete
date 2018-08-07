var mongoose = require('mongoose');
var util     = require('util');
var Schema   = mongoose.Schema;
var Model    = mongoose.Model;

function parseUpdateArguments (conditions, doc, options, callback) {
    if ('function' === typeof options) {
        // .update(conditions, doc, callback)
        callback = options;
        options = null;
    } else if ('function' === typeof doc) {
        // .update(doc, callback);
        callback = doc;
        doc = conditions;
        conditions = {};
        options = null;
    } else if ('function' === typeof conditions) {
        // .update(callback)
        callback = conditions;
        conditions = undefined;
        doc = undefined;
        options = undefined;
    } else if (typeof conditions === 'object' && !doc && !options && !callback) {
        // .update(doc)
        doc = conditions;
        conditions = undefined;
        options = undefined;
        callback = undefined;
    }

    var args = [];

    if (conditions) args.push(conditions);
    if (doc) args.push(doc);
    if (options) args.push(options);
    if (callback) args.push(callback);

    return args;
}

function parseIndexFields (options) {
    var indexFields = {
        deleted: false,
        deletedAt: false,
        deletedBy: false
    };

    if (!options.indexFields) {
        return indexFields;
    }

    if ((typeof options.indexFields === 'string' || options.indexFields instanceof String) && options.indexFields === 'all') {
        indexFields.deleted = indexFields.deletedAt = indexFields.deletedBy = true;
    }

    if (typeof(options.indexFields) === "boolean" && options.indexFields === true) {
        indexFields.deleted = indexFields.deletedAt = indexFields.deletedBy = true;
    }

    if (Array.isArray(options.indexFields)) {
        indexFields.deleted = options.indexFields.indexOf('deleted') > -1;
        indexFields.deletedAt = options.indexFields.indexOf('deletedAt') > -1;
        indexFields.deletedBy = options.indexFields.indexOf('deletedBy') > -1;
    }

    return indexFields;
}

function createSchemaObject (typeKey, typeValue, options) {
    options[typeKey] = typeValue;
    return options;
}

module.exports = function mongooseSoftDelete( schema, options ){
    var options     = options || {};
    var typeKey     = schema.options.typeKey;
    var indexFields = parseIndexFields(options);
    var methods     = ['count', 'find', 'findOne', 'findOneAndUpdate', 'update'];

    schema.add({ deleted : createSchemaObject(typeKey, Boolean, { default: false, index: indexFields.deleted }) });
    schema.add({ deletedAt: createSchemaObject(typeKey, Date, { index: indexFields.deletedAt }) });

    if( options.deletedBy === true ){
        schema.add({ deletedBy: createSchemaObject(typeKey, options.deletedByType || Schema.Types.ObjectId, { index: indexFields.deletedBy }) });
    }    

    methods.forEach(function( method ){
        if( method === 'count' || method === 'find' || method === 'findOne' ){
            
            schema.statics[method] = function(){
                return Model[method].apply(this, arguments).where({ deleted : { $ne : true } });
            };

            schema.statics[method + 'Deleted'] = function(){
                return Model[method].apply(this, arguments).where({ deleted : { $ne : true } });
            };
            
            schema.statics[method + 'WithDeleted'] = function (){
                return Model[method].apply(this, arguments).where({});
            };
        }else{

            schema.statics[method] = function () {

                var args = parseUpdateArguments.apply(undefined, arguments);

                args[0].deleted = {$ne : true};

                return Model[method].apply(this, args);
            };

            schema.statics[method + 'Deleted'] = function () {
                var args = parseUpdateArguments.apply(undefined, arguments);

                args[0].deleted = {$ne : false};

                return Model[method].apply(this, args);
            };

            schema.statics[method + 'WithDeleted'] = function () {

                var args = parseUpdateArguments.apply(undefined, arguments);

                return Model[method].apply(this, args);
            };
        }
    });

    schema.pre('save', function ( next ){
        if( !this.deleted ){
            this.deleted = false;
        }

        next();
    });

    schema.methods.delete = function( deletedBy, cb ){
        if( typeof deletedBy === 'function' ){
            cb = deletedBy
            deletedBy = null
        }

        this.deleted = true;

        if( schema.path('deletedAt') ){
            this.deletedAt = new Date();
        }

        if( schema.path('deletedBy') ){
            this.deletedBy = deletedBy;
        }

        // if( options.validateBeforeDelete === false ){
        //     return this.save({ validateBeforeSave: false }, cb);
        // }

        return this.save(cb);
    };

    schema.statics.delete = function( conditions, deletedBy, callback ){
        if( typeof deletedBy === 'function' ){
            callback   = deletedBy;
            conditions = conditions;
            deletedBy  = null;
        }else if( typeof conditions === 'function' ){
            callback   = conditions;
            conditions = {};
            deletedBy  = null;
        }

        var data = {
            deleted: true
        };

        if( schema.path('deletedAt') ){
            data.deletedAt = new Date();
        }

        if( schema.path('deletedBy') ){
            data.deletedBy = deletedBy;
        }

        if( this.updateWithDeleted ){
            return this.updateWithDeleted(conditions, data, { multi: true }, callback);
        }else{
            return this.update(conditions, data, { multi: true }, callback);
        }
    };

    schema.statics.findByIdAndDelete = function( id, deletedBy, callback ){
        var data = {
            deleted : true,
        };

        if( schema.path('deletedAt') ){
            data.deletedAt = new Date();
        }

        if( schema.path('deletedBy') ){
            data.deletedBy = deletedBy;
        }

        return this.findByIdAndUpdate( id, data );
    };

    schema.statics.findOneAndDelete = function( conditions, deletedBy, callback ){
        if( typeof deletedBy === 'function' ){
            callback = deletedBy;
            conditions = conditions;
            deletedBy = null;
        }else if( typeof conditions === 'function' ){
            callback = conditions;
            conditions = {};
            deletedBy = null;
        }

        var data = {
            deleted : true,
        };

        if( schema.path('deletedAt') ){
            data.deletedAt = new Date();
        }

        if( schema.path('deletedBy') ){
            data.deletedBy = deletedBy;
        }

        if( this.updateWithDeleted ){
            return this.updateWithDeleted(conditions, data, { multi: true }, callback);
        }else{
            return this.findOneAndUpdate( conditions, data, callback);
        }
    };

    schema.methods.restore = function( callback ){
        this.deleted   = false;
        this.deletedAt = undefined;
        this.deletedBy = undefined;
        return this.save(callback);
    };

    schema.statics.restore =  function( conditions, callback ){
        if( typeof conditions === 'function' ){
            callback = conditions;
            conditions = {};
        }

        var doc = {
            deleted   : false,
            deletedAt : undefined,
            deletedBy : undefined
        };

        if (this.updateWithDeleted) {
            return this.updateWithDeleted(conditions, doc, { multi: true }, callback);
        } else {
            return this.update(conditions, doc, { multi: true }, callback);
        }
    };
};