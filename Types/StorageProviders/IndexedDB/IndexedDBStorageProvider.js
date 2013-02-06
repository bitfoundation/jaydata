$data.Class.define('$data.storageProviders.indexedDb.IndexedDBStorageProvider', $data.StorageProviderBase, null,
{
    constructor: function (cfg, ctxInstance) {
        // mapping IndexedDB types to browser invariant name
        this.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
        this.IDBRequest = window.IDBRequest || window.webkitIDBRequest || window.mozIDBRequest || window.msIDBRequest;
        this.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.msIDBTransaction;
        this.IDBTransactionType = { READ_ONLY: "readonly", READ_WRITE: "readwrite", VERSIONCHANGE: "versionchange" }
        if (this.IDBTransaction.READ_ONLY && this.IDBTransaction.READ_WRITE) {
            this.IDBTransactionType.READ_ONLY = this.IDBTransaction.READ_ONLY
            this.IDBTransactionType.READ_WRITE = this.IDBTransaction.READ_WRITE
        }

        this.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.mozIDBKeyRange || window.msIDBKeyRange;
        this.IDBDatabaseException = window.IDBDatabaseException || window.webkitIDBDatabaseException || window.mozIDBDatabaseException || window.msIDBDatabaseException;
        this.IDBOpenDBRequest = window.IDBOpenDBRequest || window.webkitIDBOpenDBRequest || window.mozIDBOpenDBRequest || window.msIDBOpenDBRequest;
        this.newVersionAPI = !!(window.IDBFactory && IDBFactory.prototype.deleteDatabase);
        this.sequenceStore = '__jayData_sequence';
        this.SqlCommands = [];
        this.context = {};
        this.providerConfiguration = $data.typeSystem.extend({
            databaseName: 'JayDataDemo',
            version: 1,
            dbCreation: $data.storageProviders.DbCreationType.DropTableIfChanged,
            memoryOperations: true
        }, cfg);
        this._setupExtensionMethods();

        if (ctxInstance)
            this.originalContext = ctxInstance.getType();
    },
    supportedBinaryOperators: {
        value: {
            equal: { mapTo: ' == ', dataType: $data.Boolean },
            notEqual: { mapTo: ' != ', dataType: $data.Boolean },
            equalTyped: { mapTo: ' === ', dataType: $data.Boolean },
            notEqualTyped: { mapTo: ' !== ', dataType: $data.Boolean },
            greaterThan: { mapTo: ' > ', dataType: $data.Boolean },
            greaterThanOrEqual: { mapTo: ' >= ', dataType: $data.Boolean },
            lessThan: { mapTo: ' < ', dataType: $data.Boolean },
            lessThenOrEqual: { mapTo: ' <= ', dataType: $data.Boolean },

            or: { mapTo: ' || ', dataType: $data.Boolean },
            and: { mapTo: ' && ', dataType: $data.Boolean }
            //'in': { mapTo: ' in ', dataType: $data.Boolean, resolvableType: [$data.Array, $data.Queryable] }
        }
    },
    supportedSetOperations: {
        value: {
            filter: {},
            map: {},
            length: {},
            forEach: {},
            toArray: {},
            single: {},
            //some: {},
            //every: {},
            take: {},
            skip: {},
            orderBy: {},
            orderByDescending: {},
            first: {}
        },
        enumerable: true,
        writable: true
    },
    supportedFieldOperations: {
        value: {
            length: { mapTo: "length", dataType: 'number' },
            startsWith: { mapTo: "$data.StringFunctions.startsWith", dataType: "boolean", parameters: [{ name: "p1", dataType: "string" }] },
            endsWith: { mapTo: "$data.StringFunctions.endsWith", dataType: "boolean", parameters: [{ name: "p1", dataType: "string" }] },
            contains: { mapTo: "$data.StringFunctions.contains", dataType: "boolean", parameters: [{ name: "p1", dataType: "string" }] },
        },
        enumerable: true,
        writable: true
    },
    supportedUnaryOperators: {
        value: {
        },
        enumerable: true,
        writable: true
    },
    _setupExtensionMethods: function () {
        /// <summary>
        /// Sets the extension method 'setCallback' on IDBRequest, IDBOpenDBRequest, and IDBTransaction types
        /// </summary>
        var self = this;
        var idbRequest = this.IDBRequest;
        var idbTran = this.IDBTransaction;
        var idbOpenDBRequest = this.IDBOpenDBRequest;
        var setCallbacks = function (callbackSettings) {
            /// <summary>
            /// Sets the callbacks on the object.
            /// </summary>
            /// <param name="callbackSettings">Named value pairs of the callbacks</param>
            if (typeof callbackSettings !== 'object')
                Guard.raise(new Exception('Invalid callbackSettings', null, callbackSettings));
            for (var i in callbackSettings) {
                if (typeof this[i] === 'undefined' || typeof callbackSettings[i] !== 'function')
                    continue;
                this[i] = callbackSettings[i];
            }

            //if (this.readyState == self.IDBRequest.DONE)
            //    console.log('WARNING: request finished before setCallbacks. Do not use breakpoints between creating the request object and finishing the setting of callbacks');
            return this;
        };
        if (idbRequest && typeof idbRequest.prototype.setCallbacks !== 'function')
            idbRequest.prototype.setCallbacks = setCallbacks;
        if (idbTran && typeof idbTran.prototype.setCallbacks !== 'function')
            idbTran.prototype.setCallbacks = setCallbacks;
        if (idbOpenDBRequest && typeof idbOpenDBRequest.prototype.setCallbacks !== 'function')
            idbOpenDBRequest.prototype.setCallbacks = setCallbacks;
    },
    supportedDataTypes: {
        value: [$data.Integer, $data.Number, $data.Date, $data.String, $data.Boolean, $data.Blob, $data.Array, $data.Object, $data.Guid, $data.GeographyPoint,
            $data.GeographyLineString, $data.GeographyPolygon, $data.GeographyMultiPoint, $data.GeographyMultiLineString, $data.GeographyMultiPolygon, $data.GeographyCollection,
            $data.GeometryPoint, $data.GeometryLineString, $data.GeometryPolygon, $data.GeometryMultiPoint, $data.GeometryMultiLineString, $data.GeometryMultiPolygon, $data.GeometryCollection],
        writable: false
    },
    fieldConverter: {
        value: {
            fromDb: {
                '$data.Integer': function (i) { return i; },
                '$data.Number': function (number) { return number; },
                '$data.Date': function (date) { return date; },
                '$data.String': function (string) { return string; },
                '$data.Boolean': function (b) { return b; },
                '$data.Blob': function (blob) { return blob; },
                '$data.Array': function (arr) { if (arr === undefined) { return new $data.Array(); } return arr; },
                '$data.Object': function (obj) { return obj; },
                "$data.Guid": function (g) { return g ? $data.parseGuid(g) : g; },
                '$data.GeographyPoint': function (g) { if (g) { return new $data.GeographyPoint(g); } return g; },
                '$data.GeographyLineString': function (g) { if (g) { return new $data.GeographyLineString(g); } return g; },
                '$data.GeographyPolygon': function (g) { if (g) { return new $data.GeographyPolygon(g); } return g; },
                '$data.GeographyMultiPoint': function (g) { if (g) { return new $data.GeographyMultiPoint(g); } return g; },
                '$data.GeographyMultiLineString': function (g) { if (g) { return new $data.GeographyMultiLineString(g); } return g; },
                '$data.GeographyMultiPolygon': function (g) { if (g) { return new $data.GeographyMultiPolygon(g); } return g; },
                '$data.GeographyCollection': function (g) { if (g) { return new $data.GeographyCollection(g); } return g; },
                '$data.GeometryPoint': function (g) { if (g) { return new $data.GeometryPoint(g); } return g; },
                '$data.GeometryLineString': function (g) { if (g) { return new $data.GeometryLineString(g); } return g; },
                '$data.GeometryPolygon': function (g) { if (g) { return new $data.GeometryPolygon(g); } return g; },
                '$data.GeometryMultiPoint': function (g) { if (g) { return new $data.GeometryMultiPoint(g); } return g; },
                '$data.GeometryMultiLineString': function (g) { if (g) { return new $data.GeometryMultiLineString(g); } return g; },
                '$data.GeometryMultiPolygon': function (g) { if (g) { return new $data.GeometryMultiPolygon(g); } return g; },
                '$data.GeometryCollection': function (g) { if (g) { return new $data.GeometryCollection(g); } return g; }
            },
            toDb: {
                '$data.Integer': function (i) { return i; },
                '$data.Number': function (number) { return number; },
                '$data.Date': function (date) { return date; },
                '$data.String': function (string) { return string; },
                '$data.Boolean': function (b) { return b; },
                '$data.Blob': function (blob) { return blob; },
                '$data.Array': function (arr) { return arr; },
                '$data.Object': function (obj) { return obj; },
                "$data.Guid": function (g) { return g ? g.value : g; },
                '$data.GeographyPoint': function (g) { if (g) { return g; } return g; },
                '$data.GeographyLineString': function (g) { if (g) { return g; } return g; },
                '$data.GeographyPolygon': function (g) { if (g) { return g; } return g; },
                '$data.GeographyMultiPoint': function (g) { if (g) { return g; } return g; },
                '$data.GeographyMultiLineString': function (g) { if (g) { return g; } return g; },
                '$data.GeographyMultiPolygon': function (g) { if (g) { return g; } return g; },
                '$data.GeographyCollection': function (g) { if (g) { return g; } return g; },
                '$data.GeometryPoint': function (g) { if (g) { return g; } return g; },
                '$data.GeometryLineString': function (g) { if (g) { return g; } return g; },
                '$data.GeometryPolygon': function (g) { if (g) { return g; } return g; },
                '$data.GeometryMultiPoint': function (g) { if (g) { return g; } return g; },
                '$data.GeometryMultiLineString': function (g) { if (g) { return g; } return g; },
                '$data.GeometryMultiPolygon': function (g) { if (g) { return g; } return g; },
                '$data.GeometryCollection': function (g) { if (g) { return g; } return g; }
            }
        }
    },

    _getObjectStoreDefinition: function (setDefinition) {
        var contextStore = {
            storeName: setDefinition.TableName
        };
        var keyFields = setDefinition.PhysicalType.memberDefinitions.getKeyProperties();

        if (0 == keyFields.length) {
            var error = new Error("Entity must have a key field: " + contextStore.storeName);
            error.name = "KeyNotFoundError";
            throw error;
        }
        /*if (1 != keyFields.length) {
            var error = new Error("Entity must have only one key field: " + contextStore.storeName);
            error.name = "MultipleKeysNotSupportedError";
            throw error;
        }*/
        //var keyField = keyFields[0];
        for (var i = 0; i < keyFields.length; i++) {

            if (keyFields[i].computed === true &&
                ("$data.Integer" !== Container.resolveName(keyFields[i].type))) {
                var error = new Error("Computed key field must be of integer type: " + contextStore.storeName);
                error.name = "ComputedKeyFieldError";
                throw error;
            }
            if (keyFields.length > 2 && keyFields[i].computed) {
                var error = new Error("With multiple keys the computed field is not allowed: " + contextStore.storeName);
                error.name = "MultipleComputedKeyFieldError";
                throw error;
            }
        }

        contextStore.keyFields = keyFields;
        return contextStore;
    },

    _getObjectStoreDefinitions: function () {
        var objectStoreDefinitions = [];
        var self = this;
        self.context._storageModel.forEach(function (memDef) {
            var objectStoreDefinition = self._getObjectStoreDefinition(memDef);
            objectStoreDefinitions.push(objectStoreDefinition);
        });
        return objectStoreDefinitions;
    },

    _oldCreateDB: function (setVersionTran, definitions, onready) {
        var self = this;
        setVersionTran.db.onversionchange = function (event) {
            return event.target.close();
        };

        self._createDB(setVersionTran.db, definitions);
        setVersionTran.oncomplete = onready;
    },
    _createDB: function (db, definitions) {
        for (var i = 0; i < definitions.length; i++) {
            var storeDef = definitions[i];

            if (!db.objectStoreNames.contains(storeDef.storeName)) {
                var settings = {};
                if (storeDef.keyFields.length == 1) {
                    settings = {
                        keyPath: storeDef.keyFields[0].name,
                        autoIncrement: storeDef.keyFields[0].computed
                    };
                } else {
                    settings.key = [];
                    for (var i = 0; i < storeDef.keyFields.length; i++) {
                        settings.key.push(storeDef.keyFields[i].name);
                    }
                }
                db.createObjectStore(storeDef.storeName, settings);
            }
        }
    },
    _hasDbChanges: function (db, definitions) {
        var isOriginal = true;
        for (var i = 0; i < definitions.length && isOriginal; i++) {
            isOriginal = isOriginal && db.objectStoreNames.contains(definitions[i].storeName);
        }

        return !isOriginal;
    },
    onupgradeneeded: function (objectStoreDefinitions) {
        var self = this;
        return function (e) {
            var db = e.target.result;
            db.onversionchange = function (event) {
                return event.target.close();
            };
            var hasTableChanges = self._hasDbChanges(db, objectStoreDefinitions);
            if (hasTableChanges)
                self._createDB(db, objectStoreDefinitions);
        }
    },

    initializeStore: function (callBack) {
        callBack = $data.typeSystem.createCallbackSetting(callBack);
        var self = this;

        this.initializeMemoryStore({
            success: function () {
                var objectStoreDefinitions;
                try {
                    objectStoreDefinitions = self._getObjectStoreDefinitions();
                } catch (e) {
                    console.log(objectStoreDefinitions);
                    callBack.error(e);
                    return;
                }
                self.indexedDB.open(self.providerConfiguration.databaseName).setCallbacks({
                    onsuccess: function (e) {
                        var db = e.target.result;
                        db.onversionchange = function (event) {
                            return event.target.close();
                        };

                        var hasTableChanges = self._hasDbChanges(db, objectStoreDefinitions);
                        //oldAPI
                        if (db.setVersion) {
                            if (db.version === "" || hasTableChanges) {
                                db.setVersion(parseInt(db.version) || 1).setCallbacks({
                                    onsuccess: function (e) {
                                        var db = e.target.result
                                        self._oldCreateDB(db /*setVerTran*/, objectStoreDefinitions, function (e) {
                                            self.db = e.target.db;
                                            callBack.success(self.context);
                                        });
                                    },
                                    onerror: function () {
                                        var v = arguments;
                                    },
                                    onblocked: function () {
                                        var v = arguments;
                                    }
                                });
                                return;
                            };
                        } else if (hasTableChanges) {
                            //newVersionAPI
                            db.close();
                            var version = parseInt(db.version) + 1;
                            self.indexedDB.open(self.providerConfiguration.databaseName, version).setCallbacks({
                                onsuccess: function (e) {
                                    self.db = e.target.result;
                                    callBack.success(self.context);
                                },
                                onupgradeneeded: self.onupgradeneeded(objectStoreDefinitions),
                                onerror: callBack.error,
                                onabort: callBack.error,
                                onblocked: callBack.error
                            });
                            return;
                        }

                        self.db = db;
                        callBack.success(self.context);
                    },
                    //newVersionAPI
                    onupgradeneeded: self.onupgradeneeded(objectStoreDefinitions),
                    onerror: callBack.error,
                    onabort: callBack.error,
                    onblocked: callBack.error
                });
            },
            error: callBack.error
        });
    },
    initializeMemoryStore: function (callBack) {
        callBack = $data.typeSystem.createCallbackSetting(callBack);
        var self = this;

        if (false && self.originalContext && self.providerConfiguration.memoryOperations) {
            //never run 
            //self.operationProvider = new self.originalContext({ name: 'InMemory' });
            //self.operationProvider.onReady({
            //    success: function () {
            //        self.supportedBinaryOperators = self.operationProvider.storageProvider.supportedBinaryOperators;
            //        self.supportedSetOperations = self.operationProvider.storageProvider.supportedSetOperations;
            //        self.supportedFieldOperations = self.operationProvider.storageProvider.supportedFieldOperations;
            //        self.supportedUnaryOperators = self.operationProvider.storageProvider.supportedUnaryOperators;
            //        callBack.success();
            //    },
            //    error: callBack.error
            //});
        } else {
            callBack.success();
        }
    },

    _initializeStore: function (callBack) {
        callBack = $data.typeSystem.createCallbackSetting(callBack);
        var self = this;


        var initDb = function (db) {
            db.onversionchange = function (event) {
                var ret = event.target.close();
                return ret;
            };
            var newSequences = [];
            self.context._storageModel.forEach(function (memDef) {
                function createStore() {
                    /// <summary>
                    /// Creates a store for 'memDef'
                    /// </summary>
                    var osParam = {};
                    var keySettings = self._getKeySettings(memDef);
                    if (self.newVersionAPI) {
                        if (keySettings.autoIncrement)
                            newSequences.push(memDef.TableName);
                    } else {
                        osParam.autoIncrement = keySettings.autoIncrement;
                    }
                    if (keySettings.keyPath !== undefined)
                        osParam.keyPath = keySettings.keyPath;
                    db.createObjectStore(memDef.TableName, osParam);
                }
                if (db.objectStoreNames.contains(memDef.TableName)) {
                    // ObjectStore already present.
                    if (self.providerConfiguration.dbCreation === $data.storageProviders.DbCreationType.DropAllExistingTables) {
                        // Force drop and recreate object store
                        db.deleteObjectStore(memDef.TableName);
                        createStore();
                    }
                } else {
                    // Store does not exists yet, we need to create it
                    createStore();
                }
            });
            if (newSequences.length > 0 && !db.objectStoreNames.contains(self.sequenceStore)) {
                // Sequence store does not exists yet, we create it
                db.createObjectStore(self.sequenceStore, { keyPath: 'store' });
                newSequences = [];
            }
            return newSequences;
        }
        var newSequences = null;
        // Creating openCallbacks settings for both type of db.open() method
        var openCallbacks = {
            onupgradeneeded: function (event) {
                newSequences = initDb(event.target.result);
            },
            onerror: callBack.error,
            onblocked: callBack.error,
            onsuccess: function (event) {
                self.db = event.target.result;
                self.db.onversionchange = function (event) {
                    event.target.close();
                }
                if (self.newVersionAPI) {
                    if (newSequences && newSequences.length > 0) {
                        var store = self.db.transaction([self.sequenceStore], self.IDBTransactionType.READ_WRITE).setCallbacks({
                            onerror: callBack.error,
                            oncomplete: function () {
                                callBack.success(self.context);
                            }
                        }).objectStore(self.sequenceStore);
                        switch (self.providerConfiguration.dbCreation) {
                            case $data.storageProviders.DbCreationType.DropAllExistingTables:
                            case $data.storageProviders.DbCreationType.DropTableIfChanged:
                                // Clearing all data
                                store.clear();
                                break;
                            default:
                                // Removing data for newly created stores, if they previously existed
                                newSequences.forEach(function (item) {
                                    store['delete'](item);
                                });
                                break;
                        }
                    }
                    callBack.success(self.context);
                }
                else {
                    // Calling setVersion on webkit
                    var versionRequest = self.db.setVersion(self.providerConfiguration.version.toString()).setCallbacks({
                        onerror: callBack.error,
                        onblocked: callBack.error,
                        onsuccess: function (event) {
                            initDb(self.db);
                            versionRequest.result.oncomplete = function (evt) {
                                callBack.success(self.context);
                            }
                        }
                    });
                }
            }
        };
        // For Firefox we need to pass the version here
        if (self.newVersionAPI)
            self.indexedDB.open(self.providerConfiguration.databaseName, parseInt(self.providerConfiguration.version, 10)).setCallbacks(openCallbacks);
        else
            self.indexedDB.open(self.providerConfiguration.databaseName).setCallbacks(openCallbacks);
    },
    _compile: function (query, callback) {
        var compiler = Container.createIndexedDBCompiler(this);
        var compiledQuery = compiler.compile(query, {
            success: function (compiledQuery) {
                callback.success(compiledQuery);
            }
        });

        return compiledQuery;
    },
    getTraceString: function (query) {
        var compiledExpression = this._compile(query);
        var executor = Container.createIndexedDBExpressionExecutor(this);
        executor.runQuery(compiledExpression);
        return compiledExpression;
    },
    executeQuery: function (query, callBack) {
        var start = new Date().getTime();
        callBack = $data.typeSystem.createCallbackSetting(callBack);
        var self = this;

        this._compile(query, {
            success: function (expression) {
                var executor = Container.createIndexedDBExpressionExecutor(self);
                executor.runQuery(expression, {
                    success: function (result) {
                        var modelBinderCompiler = Container.createModelBinderConfigCompiler(query, []);
                        modelBinderCompiler.Visit(query.expression);
                        query.rawDataList = result;
                        console.log("execute Query in milliseconds:", new Date().getTime() - start);
                        callBack.success(query);
                    }
                });
            }
        });
    },
    _getKeySettings: function (memDef) {
        /// <summary>
        /// Gets key settings for item type's member definition
        /// </summary>
        /// <param name="memDef">memDef of item</param>
        /// <returns>KeySettings object</returns>
        var self = this;
        var settings = { autoIncrement: false };
        var keys = [];
        memDef.PhysicalType.memberDefinitions
            .getPublicMappedProperties().forEach(function (item) {
                if (item.key) {
                    // We found a key
                    keys.push(item.name);
                }
                if (item.computed) {
                    // AutoIncrement field, must be key
                    if (!item.key)
                        Guard.raise(new Exception('Only key field can be a computed field!'));
                    settings.autoIncrement = true;
                }
            });
        if (keys.length > 1) {
            if (settings.autoIncrement)
                Guard.raise(new Exception('Auto increment is only valid for a single key!'));
            // Setting key fields (composite key)
            settings.keys = keys;
        } else if (keys.length == 1) {
            // Simple key
            settings.keyPath = keys[0];
        } else {
            Guard.raise(new Exception('No valid key found!'));
        }
        return settings;
    },
    saveChanges: function (callBack, changedItems) {
        var self = this;
        // Building independent blocks and processing them sequentially
        var independentBlocks = self.buildIndependentBlocks(changedItems);
        function saveNextIndependentBlock() {
            /// <summary>
            /// Saves the next independent block
            /// </summary>
            if (independentBlocks.length === 0) {
                // No more blocks left, calling success callback
                callBack.success();
            } else {
                // 'Popping' next block
                var currentBlock = independentBlocks.shift();
                // Collecting stores of items for transaction initialize
                var storesObj = {};
                // Generating physicalData
                var convertedItems = currentBlock.map(function (item) {
                    storesObj[item.entitySet.tableName] = true;
                    item.physicalData = {};
                    self.context._storageModel.getStorageModel(item.data.getType())
                        .PhysicalType.memberDefinitions
                        .getPublicMappedProperties().forEach(function (memDef) {
                            if (memDef.key && memDef.computed && item.data[memDef.name] == undefined) {
                                // Autogenerated fields for new items should not be present in the physicalData
                                return;
                            }
                            if (typeof memDef.concurrencyMode === 'undefined' && (memDef.key === true || item.data.entityState === $data.EntityState.Added || (item.data.changedProperties && item.data.changedProperties.some(function (def) { return def.name === memDef.name; })))) {
                                var typeName = Container.resolveName(memDef.type);
                                if (self.fieldConverter.toDb[typeName]) {
                                    item.physicalData[memDef.name] = self.fieldConverter.toDb[typeName](item.data[memDef.name]);
                                } else {
                                    console.log('WARN!!!');
                                    item.physicalData[memDef.name] = item.data[memDef.name];
                                }
                            }
                        });
                    return item;
                });
                var stores = [];
                for (var i in storesObj) {
                    stores.push(i);
                }
                var tran = self.db.transaction(stores, self.IDBTransactionType.READ_WRITE).setCallbacks({
                    onerror: function (event) {
                        // Only call the error callback when it's not because of an abort
                        // aborted cases should call the error callback there
                        if (event.target.errorCode !== self.IDBDatabaseException.ABORT_ERR)
                            callBack.error(event);
                    },
                    oncomplete: function (event) {
                        // Moving to next block
                        saveNextIndependentBlock();
                    }
                });
                function KeySettingsCache() {
                    /// <summary>
                    /// Simple cache for key settings of types
                    /// </summary>
                    var cache = {};
                    this.getSettingsForItem = function (item) {
                        var typeName = item.data.getType().fullName;
                        if (!cache.hasOwnProperty(typeName)) {
                            cache[typeName] = self._getKeySettings(self.context._storageModel.getStorageModel(item.data.getType()));
                        }
                        return cache[typeName]
                    }
                }
                var ksCache = new KeySettingsCache();
                convertedItems.forEach(function (item) {
                    // Getting store and keysettings for the current item
                    var store = tran.objectStore(item.entitySet.tableName);
                    var keySettings = ksCache.getSettingsForItem(item);
                    // Contains the keys that should be passed for create, update and delete (composite keys)
                    var itemKeys = keySettings.keys && keySettings.keys.map(function (key) { return item.physicalData[key]; }) || null;
                    try {
                        var cursorAction = function (action) {
                            /// <summary>
                            /// Find the current item in the store, and calls the action on it. Error raised when item was not found
                            /// </summary>
                            /// <param name="action">Action to call on the item</param>
                            var key = keySettings.keyPath ? item.physicalData[keySettings.keyPath] : itemKeys;
                            var data = item.physicalData;
                            store.openCursor(self.IDBKeyRange.only(key))
                                .onsuccess = function (event) {
                                    try {
                                        var cursor = event.target.result;
                                        if (cursor)
                                            action(cursor, key, data);
                                        else
                                            Guard.raise(new Exception('Object not found', null, item));
                                    } catch (ex) {
                                        tran.abort();
                                        callBack.error(ex);
                                    }
                                }
                        };
                        switch (item.data.entityState) {
                            case $data.EntityState.Added:
                                if (!keySettings.keyPath) {
                                    // Item needs explicit keys
                                    store.add(item.physicalData, itemKeys);
                                }
                                else {
                                    store.add(item.physicalData)
                                        .onsuccess = function (event) {
                                            // Saves the generated key back to the entity
                                            item.data[keySettings.keyPath] = event.target.result;
                                        };
                                }
                                break;
                            case $data.EntityState.Deleted:
                                // Deletes the item
                                cursorAction(function (cursor) {
                                    cursor['delete']();
                                });
                                break;
                            case $data.EntityState.Modified:
                                // Updates the item
                                cursorAction(function (cursor, key, data) {
                                    cursor.update($data.typeSystem.extend(cursor.value, data));
                                });
                                break;
                            case $data.EntityState.Unchanged:
                                break;
                            default:
                                Guard.raise(new Exception('Not supported entity state', null, item));
                        }
                    } catch (ex) {
                        // Abort on exceptions
                        tran.abort();
                        callBack.error(ex);
                    }
                });
            }
        }
        saveNextIndependentBlock();
    },
}, {
    isSupported: {
        get: function () {
            return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB ? true : false;
        },
        set: function () { }
    }
});

if ($data.storageProviders.indexedDb.IndexedDBStorageProvider.isSupported)
    $data.StorageProviderBase.registerProvider('indexedDb', $data.storageProviders.indexedDb.IndexedDBStorageProvider);