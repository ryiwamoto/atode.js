"use strict";
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Atode;
(function (Atode) {
    //=============ECMA Script internal===========
    function assert(condition, message) {
        if (!condition) {
            throw "Assertion failed: " + message || "Assertion failed: unknown";
        }
    }
    function isCallable(f) {
        return typeof f === "function";
    }
    function isObject(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    }
    function enqueueJob(name, job) {
        setTimeout(job, 0);
    }
    function has(obj, name) {
        return obj && obj.hasOwnProperty && obj.hasOwnProperty(name);
    }
    //============================================
    var Record = (function () {
        function Record(value) {
            this.value = value;
        }
        return Record;
    })();
    var PromiseReactionHandler;
    (function (PromiseReactionHandler) {
        PromiseReactionHandler[PromiseReactionHandler["Identity"] = 0] = "Identity";
        PromiseReactionHandler[PromiseReactionHandler["Thrower"] = 1] = "Thrower";
    })(PromiseReactionHandler || (PromiseReactionHandler = {}));
    /**
     * 25.4.1.1
     * A PromiseCapability is a Record value used to encapsulate a promise object along with the functions
     * that are capable of resolving or rejecting that promise object.
     * PromiseCapability records are produced by the NewPromiseCapability abstract operation.
     */
    var PromiseCapability = (function () {
        /**
         * @param promise An object that is usable as a promise.
         * @param resolve The function that is used to resolve the given promise object.
         * @param reject The function that is used to reject the given promise object.
         */
        function PromiseCapability(promise, resolve, reject) {
            this.promise = promise;
            this.resolve = resolve;
            this.reject = reject;
        }
        return PromiseCapability;
    })();
    /**
     * 25.4.1.2
     * The PromiseReaction is a Record value used to store information about how a promise should react when
     * it becomes resolved or rejected with a given value. PromiseReaction records are created by the then
     * method of the Promise prototype, and are used by a PromiseReactionJob.
     */
    var PromiseReaction = (function () {
        /**
         * @param capabilities The capabilities of the promise for which this record provides a reaction handler.
         * @param handler The function that should be applied to the incoming value, and
         * whose return value will govern what happens to the derived
         * promise. If [[Handler]] is "Identity" it is equivalent to a
         * function that simply returns its first argument. If [[Handler]] is
         * "Thrower" it is equivalent to a function that throws its first argument as an exception.
         */
        function PromiseReaction(capabilities, handler /* Function | PromiseReactionHandler */) {
            this.capabilities = capabilities;
            this.handler = handler;
        }
        return PromiseReaction;
    })();
    /**
     * 25.4.14
     * @param promise
     */
    function createResolvingFunctions(promise) {
        var alreadyResolved = new Record(false);
        var resolve = PromiseResolveFunction(promise, alreadyResolved);
        var reject = PromiseRejectFunction(promise, alreadyResolved);
        return { resolve: resolve, reject: reject };
    }
    /**
     * 24.1.4.1
     * A promise reject function is an anonymous built-in function that has [[Promise]] and [[AlreadyResolved]] internal slots.
     * @param promise
     * @param alreadyResolved
     * @constructor
     */
    function PromiseRejectFunction(promise, alreadyResolved) {
        return function PromiseRejectFunctionInstance(reason) {
            assert(!!promise && isObject(promise), " PromiseResolveFunction: F has a [[Promise]] internal slot whose value is an Object.");
            if (alreadyResolved.value) {
                return undefined;
            }
            alreadyResolved.value = true;
            return RejectPromise(promise, reason);
        };
    }
    /**
     * 25.4.1.4.2
     * A promise resolve function is an anonymous built-in function that has [[Promise]] and [[AlreadyResolved]] internal slots.
     * @param promise
     * @param alreadyResolved
     * @constructor
     */
    function PromiseResolveFunction(promise, alreadyResolved) {
        return function PromiseResolveFunctionInstance(resolution) {
            assert(!!promise && isObject(promise), " PromiseResolveFunction: F has a [[Promise]] internal slot whose value is an Object.");
            if (alreadyResolved.value) {
                return undefined;
            }
            alreadyResolved.value = true;
            if (resolution === promise) {
                var selfResolutionError = new TypeError();
                return RejectPromise(promise, selfResolutionError);
            }
            if (!isObject(resolution)) {
                return fulfillPromise(promise, resolution);
            }
            var then;
            try {
                then = resolution.then;
            }
            catch (e) {
                return RejectPromise(promise, e);
            }
            if (isCallable(then) === false) {
                return fulfillPromise(promise, resolution);
            }
            enqueueJob("PromiseJobs", PromiseResolveThenableJob(promise, resolution, then));
            return undefined;
        };
    }
    /**
     * 25.4.1.5
     * @param promise
     * @param value
     * @constructor
     */
    function fulfillPromise(promise, value) {
        assert(promise._state === 0 /* pending */, "fulfillPromise: promise [[PromiseState]] is not pending");
        var reactions = promise._fulFillReactions;
        promise._result = value;
        promise._fulFillReactions = undefined;
        promise._rejectReactions = undefined;
        promise._state = 1 /* fulfilled */;
        triggerPromiseReactions(reactions, value);
    }
    /**
     * 25.4.1.6
     * @param C
     */
    function newPromiseCapability(C) {
        //If IsConstructor(C) is false, throw a TypeError exception.
        //Assert: C is a constructor function that supports the parameter conventions of the Promise constructor (see 25.4.3.1).
        return createPromiseCapabilityRecord(new C(), Promise);
    }
    /**
     * 25.4.1.6.1
     * @param promise
     * @param constructor
     */
    function createPromiseCapabilityRecord(promise, constructor) {
        //Assert: promise is an uninitialized object created by performing constructor's CreateAction
        //Assert: IsConstructor(constructor) is true
        var promiseCapability = new PromiseCapability(promise, undefined, undefined);
        var executor = getCapabilitiesExecutor(promiseCapability);
        var constructorResult = constructor.call(promise, executor);
        if (isCallable(promiseCapability.resolve) === false) {
            throw new TypeError();
        }
        if (isCallable(promiseCapability.reject) === false) {
            throw new TypeError();
        }
        if (isObject(constructorResult) && promise !== constructorResult) {
            throw new TypeError();
        }
        return promiseCapability;
    }
    /**
     * 25.4.1.6.2
     * @param capability
     */
    function getCapabilitiesExecutor(capability) {
        return function getCapabilitiesExecutorInstance(resolve, reject) {
            assert(capability instanceof PromiseCapability, "getCapabilitiesExecutor: capability is not PromiseCapability");
            var promiseCapability = capability;
            if (promiseCapability.resolve !== undefined) {
                throw new TypeError();
            }
            if (promiseCapability.reject !== undefined) {
                throw new TypeError();
            }
            promiseCapability.resolve = resolve;
            promiseCapability.reject = reject;
            return undefined;
        };
    }
    /**
     * 25.4.1.7
     * @param x
     */
    function isPromise(x) {
        if (!isObject(x)) {
            return false;
        }
        if (!has(x, "_state")) {
            return false;
        }
        if (x._state === undefined) {
            return false;
        }
        return true;
    }
    /**
     * 25.4.1.8
     * @param promise
     * @param reason
     * @constructor
     */
    function RejectPromise(promise, reason) {
        assert(promise._state === 0 /* pending */, "RejectPromise: promise [[PromiseState]] is not pending");
        var reactions = promise._rejectReactions;
        promise._result = reason;
        promise._fulFillReactions = undefined;
        promise._rejectReactions = undefined;
        promise._state = 2 /* rejected */;
        return triggerPromiseReactions(reactions, reason);
    }
    /**
     * 25.4.1.9
     * @param reactions
     * @param argument
     */
    function triggerPromiseReactions(reactions, argument) {
        reactions.forEach(function (reaction) {
            enqueueJob("PromiseJobs", PromiseReactionJob(reaction, argument));
        });
        return undefined;
    }
    /**
     * 25.4.2.1
     * @param reaction
     * @param argument
     * @constructor
     */
    function PromiseReactionJob(reaction, argument) {
        return function () {
            assert(reaction instanceof PromiseReaction, "PromiseReactionJob: reaction is not instance of promiseReaction.");
            var promiseCapability = reaction.capabilities;
            var handler = reaction.handler;
            var handlerResult;
            try {
                if (handler === 0 /* Identity */) {
                    handlerResult = argument;
                }
                else if (handler === 1 /* Thrower */) {
                    throw argument;
                }
                else {
                    handlerResult = handler.call(undefined, argument);
                }
            }
            catch (abruptCompletionHandlerResult) {
                var status = promiseCapability.reject.call(undefined, abruptCompletionHandlerResult);
                return status;
            }
            var status = promiseCapability.resolve.call(undefined, handlerResult);
            return status;
        };
    }
    /**
     * 25.4.2.2
     * @param promiseToResolve
     * @param thenable
     * @param then
     * @constructor
     */
    function PromiseResolveThenableJob(promiseToResolve, thenable, then) {
        return function () {
            var resolvingFunctions = createResolvingFunctions(promiseToResolve);
            try {
                var thenCallResult = then.call(thenable, resolvingFunctions.resolve, resolvingFunctions.reject);
            }
            catch (abruptCompletion) {
                var status = resolvingFunctions.reject.call(undefined, abruptCompletion);
                return status;
            }
            return thenCallResult;
        };
    }
    /**
     * The possible values are: undefined, "pending", "fulfilled", and "rejected".
     */
    var PromiseState;
    (function (PromiseState) {
        PromiseState[PromiseState["pending"] = 0] = "pending";
        PromiseState[PromiseState["fulfilled"] = 1] = "fulfilled";
        PromiseState[PromiseState["rejected"] = 2] = "rejected";
    })(PromiseState || (PromiseState = {}));
    var PromiseInstance = (function () {
        function PromiseInstance() {
            /**
             * A string value that governs how a promise will react to incoming calls to its then method.
             * @type {undefined}
             * @private
             */
            this._state = undefined;
        }
        /**
         * 25.4.5.3
         * @param onFulfilled
         * @param onRejected
         */
        PromiseInstance.prototype.then = function (onFulfilled, onRejected) {
            var promise = this;
            if (isPromise(promise) === false) {
                throw TypeError();
            }
            var c = PromiseInstance;
            var resultCapability = newPromiseCapability(c);
            return performPromiseThen(promise, onFulfilled, onRejected, resultCapability);
        };
        return PromiseInstance;
    })();
    var Promise = (function (_super) {
        __extends(Promise, _super);
        /**
         * 25.4.3.1
         * @param executor
         */
        function Promise(executor) {
            _super.call(this);
            if (!(this instanceof PromiseInstance)) {
                return new Promise(executor);
            }
            else {
                var promise = this;
                if (!isObject(promise)) {
                    throw new TypeError();
                }
                if (!has(promise, "_state")) {
                    throw new TypeError();
                }
                if (promise._state !== undefined) {
                    throw new TypeError();
                }
                if (!isCallable(executor)) {
                    throw new TypeError();
                }
                return initializePromise(promise, executor);
            }
        }
        /**
         * 25.4.4.4
         * @param r
         */
        Promise.reject = function (r) {
            var C = PromiseInstance;
            if (!isObject(C)) {
                throw new TypeError("Promise.resolve: Type(C) is not Object");
            }
            /*
             * Let S be Get(C, @@species).
             * ReturnIfAbrupt(S).
             * If S is neither undefined nor null, then let C be S.
             */
            var promiseCapability = newPromiseCapability(C);
            var rejectResult = promiseCapability.reject.call(undefined, r);
            return promiseCapability.promise;
        };
        /**
         * 25.4.4.5
         * @param x
         */
        Promise.resolve = function (x) {
            var C = PromiseInstance;
            if (isPromise(x)) {
                var constructor = x.constructor;
                if (constructor === C) {
                    return x;
                }
            }
            if (!isObject(C)) {
                throw new TypeError("Promise.resolve: Type(C) is not Object");
            }
            /*
             * Let S be Get(C, @@species).
             * ReturnIfAbrupt(S).
             * If S is neither undefined nor null, then let C be S.
             */
            var promiseCapability = newPromiseCapability(C);
            var resolveResult = promiseCapability.resolve.call(undefined, x);
            return promiseCapability.promise;
        };
        return Promise;
    })(PromiseInstance);
    Atode.Promise = Promise;
    /**
     * 25.4.3.1.1
     * @param promise
     * @param executor
     */
    function initializePromise(promise, executor) {
        assert(has(promise, "_state"), "initializePromise: this does not have [[PromiseState]]");
        assert(promise._state === undefined, "initializePromise: promise [[promiseState]] is not undefined");
        assert(isCallable(executor) === true, "initializePromise: executor is not callable");
        promise._state = 0 /* pending */;
        promise._fulFillReactions = [];
        promise._rejectReactions = [];
        var resolvingFunctions = createResolvingFunctions(promise);
        try {
            var completion = executor.call(undefined, resolvingFunctions.resolve, resolvingFunctions.reject);
        }
        catch (completionValue) {
            var status = resolvingFunctions.reject.call(undefined, completionValue);
            return status;
        }
        return promise;
    }
    /**
     * 25.4.5.3.1
     * @param promise
     * @param onFulfilled
     * @param onRejected
     * @param resultCapability
     */
    function performPromiseThen(promise, onFulfilled, onRejected, resultCapability) {
        assert(isPromise(promise), "performPromiseThen: promise is not Promise");
        assert(resultCapability instanceof PromiseCapability, "performPromiseThen: resultCapability is not PromiseCapability");
        if (isCallable(onFulfilled) === false) {
            onFulfilled = 0 /* Identity */;
        }
        if (isCallable(onRejected) === false) {
            onRejected = 1 /* Thrower */;
        }
        var fulfillReaction = new PromiseReaction(resultCapability, onFulfilled);
        var rejectReaction = new PromiseReaction(resultCapability, onRejected);
        if (promise._state === 0 /* pending */) {
            promise._fulFillReactions.push(fulfillReaction);
            promise._rejectReactions.push(rejectReaction);
        }
        else if (promise._state === 1 /* fulfilled */) {
            var value = promise._result;
            enqueueJob("PromiseJobs", PromiseReactionJob(fulfillReaction, value));
        }
        else if (promise._state === 2 /* rejected */) {
            var reason = promise._result;
            enqueueJob("PromiseJobs", PromiseReactionJob(rejectReaction, reason));
        }
        return resultCapability.promise;
    }
})(Atode || (Atode = {}));
(function (global) {
    if ("process" in global) {
        module["exports"] = Atode.Promise;
    }
    global["Promise" in global ? "Promise_" : "Promise"] = Atode.Promise; // switch module. http://git.io/Minify
})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule
