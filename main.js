var workers = (function() {
    if(!window.Worker) {
	throw new Error("Workers not supported");
    }

    function workQueueOrIdle(pool, worker) {
	if(pool.tasksQueue.length > 0) {
	    var [[resolve, reject], [fun, args, transfers]] = pool.tasksQueue.shift();
	    workers.useWorker(worker, fun, args, transfers)
		.then(resolve)
		.catch(reject)
		.finally(function() {
		    workQueueOrIdle(pool, worker);
		});
	} else {
	    pool.runningWorkers.splice(pool.runningWorkers.indexOf(worker), 1);
	    pool.idleWorkers.push(worker);
	}
    }

    return workers = {
	isMain: document != undefined,
	isWorker: document == undefined,
	
	createWorker: function(script) {
	    return new Worker(script);
	},

	createPool: function(size, script) {
	    var _workers = []; 
	    for(var i = 0; i < size; ++i) {
		_workers.push(workers.createWorker(script));
	    }
	    return {
		workers: _workers,
		tasksQueue: [],
		runningWorkers: [],
		idleWorkers: _workers.slice(0)};
	},

	useWorker: function(worker, fun, args, transfers) {
	    var task = new Promise(function(resolve, reject) {
		worker.onmessage = function(e) {
		    resolve(e.data);
		};
		worker.onerror = function(e) {
		    reject(e);
		};
		worker.postMessage([fun, args], transfers || []);
	    });

	    task.finally(function() {
		worker.onmessage = null;
		worker.onerror = null;
	    });

	    return task;
	},

	usePool: function(pool, fun, args, transfers) {
	    var task = null;
	    
	    if(pool.idleWorkers.length > 0) {
		var worker = pool.idleWorkers.shift();
		pool.runningWorkers.push(worker);

		task = workers.useWorker(worker, fun, args, transfers);
		task.finally(function() {
		    workQueueOrIdle(pool, worker);
		});
	    } else {
		task = new Promise(function(resolve, reject) {
		    pool.tasksQueue.push([[resolve, reject], [fun, args, transfers]]);
		});
	    }

	    return task;
	}
    };
})();
