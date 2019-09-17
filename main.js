var workers = (function() {
    if(!window.Worker) {
	throw new Error("Workers not supported");
    }

    function repeat(fun, times) {
	var result = [];
	for(var i = 0; i < times; ++i) {
	    result.push(fun.call(null));
	}
	return result;
    }

    function cut(slicesCount, array) {
	var arrayLength = array.length;
	var slicesSize = Math.floor(arrayLength / slicesCount);

	var slices = [];
	for(var i = 0; i < (slicesCount - 1); ++i) {
	    slices.push(array.slice(i * slicesSize, slicesSize));
	}
	slices.push(array.slice(i * slicesSize));
	return slices;
    }

    function workWorkerQueueOrIdle(worker) {
	if(worker.tasksQueue.length > 0) {
	    var [[resolve, reject], [fun, args, transfers]] = worker.tasksQueue.shift();

	    worker.isRunning = true;
	    worker.thread.onmessage = function(e) {
		resolve(e.data);
	    };
	    worker.thread.onerror = function(e) {
		reject(e);
	    };
	    worker.thread.postMessage([fun, args], transfers || []);
	} else {
	    worker.isRunning = false;
	}
    }

    function workPoolQueueOrIdle(pool, worker) {
	if(pool.tasksQueue.length > 0) {
	    var [[resolve, reject], [fun, args, transfers]] = pool.tasksQueue.shift();
	    var progress = workers.callWorker(worker, fun, args, transfers);
	    progress.then(resolve, reject);
	    progress.finally(() => {
		workPoolQueueOrIdle(pool, worker);
	    });
	}
    }

    return workers = {
	isMain: document != undefined,
	isWorker: document == undefined,
	
	createWorker: function(script) {
	    return {
		thread: new Worker(script),
		isRunning: false,
		tasksQueue: []
	    };
	},

	callWorker: function(worker, fun, args, transfers) {
	    var task = new Promise(function(resolve, reject) {
		worker.tasksQueue.push([[resolve, reject], [fun, args, transfers]]);
		if(!worker.isRunning) {
		    workWorkerQueueOrIdle(worker);
		}
	    });

	    task.finally(function() {
		workWorkerQueueOrIdle(worker);
	    });
	    
	    return task;
	},

	mapWorker: function(worker, fun, args) {
	    var args_ = args.slice();
	    args_.unshift(fun);

	    return workers.callWorker(worker, "pCall", args_);
	},

	createPool: function(size, script) {
	    return {
		workers: repeat(function() {
		    return workers.createWorker(script);
		}, size),
		tasksQueue: []};
	},

	callPool: function(pool, fun, args, transfers) {
	    var idleWorker = pool.workers.filter(function(worker) {
		return !worker.isRunning;
	    })[0] || null;

	    var task = new Promise(function(resolve, reject) {
		pool.tasksQueue.push([[resolve, reject], [fun, args, transfers]]);
	    });
	    
	    if(idleWorker) {
		workPoolQueueOrIdle(pool, idleWorker);
	    }

	    return task;
	},

	callEveryPoolWorker: function(pool, fun, args) {
	    return Promise.all(pool.workers.map(function(worker) {
		return workers.callWorker(worker, fun, args);
	    }));
	},

	mapPool: function(pool, fun, args, parallel) {
	    var parallelTasks = parallel || pool.workers.length;
	    var argSlices = cut(parallelTasks, args);
	    
	    return Promise
		.all(argSlices.map(function(args) {
		    var args_ = args.slice();
		    args_.unshift(fun);
		    
		    return workers.callPool(pool, "pCall", args_);
		})).
		then(function(slices) {
		    return Array.prototype.concat.apply(null, slices);
		});
	}
    };
})();
