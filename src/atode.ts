"use strict";

module Atode {
    //=============ECMA Script internal===========
    function assert(condition: boolean, message?: string) {
        if (!condition) {
            throw "Assertion failed: " + message || "Assertion failed: unknown";
        }
    }

    function isCallable(f: any) {
        return typeof f === "function";
    }

    function isObject(obj: any) {
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

    class Record<T> {
        constructor(public value: T) {
        }
    }

    enum PromiseReactionHandler{
        Identity,
        Thrower
    }

    /**
     * 25.4.1.1
     * A PromiseCapability is a Record value used to encapsulate a promise object along with the functions
     * that are capable of resolving or rejecting that promise object.
     * PromiseCapability records are produced by the NewPromiseCapability abstract operation.
     */
    class PromiseCapability {
        /**
         * @param promise An object that is usable as a promise.
         * @param resolve The function that is used to resolve the given promise object.
         * @param reject The function that is used to reject the given promise object.
         */
        constructor(public promise: Promise, public resolve: Function, public reject: Function) {
        }
    }

    /**
     * 25.4.1.2
     * The PromiseReaction is a Record value used to store information about how a promise should react when
     * it becomes resolved or rejected with a given value. PromiseReaction records are created by the then
     * method of the Promise prototype, and are used by a PromiseReactionJob.
     */
    class PromiseReaction {
        /**
         * @param capabilities The capabilities of the promise for which this record provides a reaction handler.
         * @param handler The function that should be applied to the incoming value, and
         * whose return value will govern what happens to the derived
         * promise. If [[Handler]] is "Identity" it is equivalent to a
         * function that simply returns its first argument. If [[Handler]] is
         * "Thrower" it is equivalent to a function that throws its first argument as an exception.
         */
        constructor(public capabilities: PromiseCapability, public handler: any/* Function | PromiseReactionHandler */) {
        }
    }

    /**
     * 25.4.14
     * @param promise
     */
    function createResolvingFunctions(promise: Promise): {
        resolve: Function;
        reject: Function;
    } {
        var alreadyResolved = new Record<boolean>(false);

        var resolve = PromiseResolveFunction(promise, alreadyResolved);

        var reject = PromiseRejectFunction(promise, alreadyResolved);

        return {resolve: resolve, reject: reject};
    }

    /**
     * 24.1.4.1
     * A promise reject function is an anonymous built-in function that has [[Promise]] and [[AlreadyResolved]] internal slots.
     * @param promise
     * @param alreadyResolved
     * @constructor
     */
    function PromiseRejectFunction(promise: Promise, alreadyResolved: Record<boolean>) {
        return function PromiseRejectFunctionInstance(reason: any) {
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
    function PromiseResolveFunction(promise: Promise, alreadyResolved: Record<boolean>) {
        return function PromiseResolveFunctionInstance(resolution: any) {
            assert(!!promise && isObject(promise), " PromiseResolveFunction: F has a [[Promise]] internal slot whose value is an Object.");

            if (alreadyResolved.value) {
                return undefined;
            }
            alreadyResolved.value = true;
            if (resolution === promise) { //TODO check SameValue's behavior
                var selfResolutionError = new TypeError();
                return RejectPromise(promise, selfResolutionError);
            }
            if (!isObject(resolution)) {
                return fulfillPromise(promise, resolution);
            }

            var then;
            try {
                then = resolution.then;
            } catch (e) {
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
    function fulfillPromise(promise: Promise, value: any) {
        assert(promise._state === PromiseState.pending, "fulfillPromise: promise [[PromiseState]] is not pending");
        var reactions = promise._fulFillReactions;
        promise._result = value;
        promise._fulFillReactions = undefined;
        promise._rejectReactions = undefined;
        promise._state = PromiseState.fulfilled;
        triggerPromiseReactions(reactions, value);
    }

    /**
     * 25.4.1.6
     * @param C
     */
    function newPromiseCapability(C: any): PromiseCapability {
        //If IsConstructor(C) is false, throw a TypeError exception.
        //Assert: C is a constructor function that supports the parameter conventions of the Promise constructor (see 25.4.3.1).
        return createPromiseCapabilityRecord(new C(), Promise);
    }

    /**
     * 25.4.1.6.1
     * @param promise
     * @param constructor
     */
    function createPromiseCapabilityRecord(promise: Promise, constructor: any): PromiseCapability {
        //Assert: promise is an uninitialized object created by performing constructor's CreateAction
        //Assert: IsConstructor(constructor) is true
        var promiseCapability = new PromiseCapability(promise/*promise*/, undefined /*Resolve*/, undefined/*Reject*/)
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
    function getCapabilitiesExecutor(capability: PromiseCapability) {
        return function getCapabilitiesExecutorInstance(resolve: Function, reject: Function) {
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
        }
    }

    /**
     * 25.4.1.7
     * @param x
     */
    function isPromise(x: any) {
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
    function RejectPromise(promise: Promise, reason: any) {
        assert(promise._state === PromiseState.pending, "RejectPromise: promise [[PromiseState]] is not pending");
        var reactions = promise._rejectReactions;
        promise._result = reason;
        promise._fulFillReactions = undefined;
        promise._rejectReactions = undefined;
        promise._state = PromiseState.rejected;
        return triggerPromiseReactions(reactions, reason);
    }

    /**
     * 25.4.1.9
     * @param reactions
     * @param argument
     */
    function triggerPromiseReactions(reactions: PromiseReaction[], argument: any) {
        reactions.forEach((reaction)=> {
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
    function PromiseReactionJob(reaction: PromiseReaction, argument: any) {
        return ()=> {
            assert(reaction instanceof PromiseReaction, "PromiseReactionJob: reaction is not instance of promiseReaction.");
            var promiseCapability = reaction.capabilities;
            var handler = reaction.handler;
            var handlerResult;
            try {
                if (handler === PromiseReactionHandler.Identity) {
                    handlerResult = argument;
                } else if (handler === PromiseReactionHandler.Thrower) {
                    throw argument;
                } else {
                    handlerResult = handler.call(undefined, argument);
                }
            } catch (abruptCompletionHandlerResult) {
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
    function PromiseResolveThenableJob(promiseToResolve: Promise, thenable: any, then: Function) {
        return ()=> {
            var resolvingFunctions = createResolvingFunctions(promiseToResolve);
            try {
                var thenCallResult = then.call(thenable, resolvingFunctions.resolve, resolvingFunctions.reject);
            } catch (abruptCompletion) {
                var status = resolvingFunctions.reject.call(undefined, abruptCompletion);
                return status;
            }
            return thenCallResult;
        }
    }

    /**
     * The possible values are: undefined, "pending", "fulfilled", and "rejected".
     */
    enum PromiseState {
        pending,
        fulfilled,
        rejected
    }

    class PromiseInstance {
        /**
         * A string value that governs how a promise will react to incoming calls to its then method.
         * @type {undefined}
         * @private
         */
        _state: PromiseState = undefined;

        /**
         * The value with which the promise has been fulfilled or rejected, if any. Only meaningful if [[PromiseState]] is not "pending".
         * @type {undefined}
         * @private
         */
        _result: any;

        /**
         * A List of PromiseReaction records to be processed when/if the promise transitions from the "pending" state to the"fulfilled" state.
         */
        _fulFillReactions: PromiseReaction[];

        /**
         * A List of PromiseReaction records to be processed when/if the promise transitions from the "pending" state to the"rejected" state.
         */
        _rejectReactions: PromiseReaction[];

        /**
         * 25.4.5.3
         * @param onFulfilled
         * @param onRejected
         */
        then(onFulfilled: Function, onRejected: Function) {
            var promise = this;
            if (isPromise(promise) === false) {
                throw TypeError();
            }
            var c = PromiseInstance;
            var resultCapability = newPromiseCapability(c);
            return performPromiseThen(promise, onFulfilled, onRejected, resultCapability);
        }
    }

    export class Promise extends PromiseInstance {

        /**
         * 25.4.4.4
         * @param r
         */
        static reject(r) {
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
        }

        /**
         * 25.4.4.5
         * @param x
         */
        static resolve(x: any) {
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
        }

        /**
         * 25.4.3.1
         * @param executor
         */
        constructor(executor: Function) {
            super();
            if (!(this instanceof PromiseInstance)) {
                return new Promise(executor);
            } else {
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
    }

    /**
     * 25.4.3.1.1
     * @param promise
     * @param executor
     */
    function initializePromise(promise: Promise, executor: Function) {
        assert(has(promise, "_state"), "initializePromise: this does not have [[PromiseState]]");
        assert(promise._state === undefined, "initializePromise: promise [[promiseState]] is not undefined");
        assert(isCallable(executor) === true, "initializePromise: executor is not callable");
        promise._state = PromiseState.pending;
        promise._fulFillReactions = [];
        promise._rejectReactions = [];
        var resolvingFunctions = createResolvingFunctions(promise);
        try {
            var completion = executor.call(undefined, resolvingFunctions.resolve, resolvingFunctions.reject);
        } catch (completionValue) {
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
    function performPromiseThen(promise: Promise, onFulfilled: any, onRejected: any, resultCapability: PromiseCapability): Promise {
        assert(isPromise(promise), "performPromiseThen: promise is not Promise");
        assert(resultCapability instanceof PromiseCapability, "performPromiseThen: resultCapability is not PromiseCapability");
        if (isCallable(onFulfilled) === false) {
            onFulfilled = PromiseReactionHandler.Identity;
        }
        if (isCallable(onRejected) === false) {
            onRejected = PromiseReactionHandler.Thrower;
        }
        var fulfillReaction = new PromiseReaction(resultCapability, onFulfilled);
        var rejectReaction = new PromiseReaction(resultCapability, onRejected);
        if (promise._state === PromiseState.pending) {
            promise._fulFillReactions.push(fulfillReaction);
            promise._rejectReactions.push(rejectReaction);
        } else if (promise._state === PromiseState.fulfilled) {
            var value = promise._result;
            enqueueJob("PromiseJobs", PromiseReactionJob(fulfillReaction, value));
        } else if (promise._state === PromiseState.rejected) {
            var reason = promise._result;
            enqueueJob("PromiseJobs", PromiseReactionJob(rejectReaction, reason));
        }
        return resultCapability.promise;
    }
}

//---------export------------------
declare var module: any;
declare var global: any;
(function (global) {
    if ("process" in global) {
        module["exports"] = Atode.Promise;
    }
    global["Promise" in global ? "Promise_" : "Promise"] = Atode.Promise; // switch module. http://git.io/Minify
})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule
