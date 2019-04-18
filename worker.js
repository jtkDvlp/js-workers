var workers = (function() {
    var registeredFunctions = {};

    function uuid() {
	function s4() {
	    return Math.floor((1 + Math.random()) * 0x10000)
		.toString(16)
		.substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
	    s4() + '-' + s4() + s4() + s4();
    }
    
    self.onmessage = function(e) {
	var [fun, args] = e.data;

	if(!registeredFunctions[fun]) {
	    throw new Error("Function " + workers.id + ":" + fun + " not registered");
	}

	var result = registeredFunctions[fun].apply(this, args);
	if(result && result.then && typeof result.then == "function") {
	    result.then(function(r) {
		self.postMessage(r);
	    }).catch(function(e) {
		throw new Error(e);
	    });
	} else if(result !== undefined) {
	    self.postMessage(result);
	}
    };
    
    return {
	id: uuid(),
	
	isMain: self.document != undefined,
	isWorker: self.document == undefined, 
	
	register: function(name, fun) {
	    registeredFunctions[name] = fun;
	},

	respond: function(data, transfers) {
	    self.postMessage(data, transfers);
	}
    };
})();
