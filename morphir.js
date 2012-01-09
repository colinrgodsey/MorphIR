function Morph() {
	var bc = this.bc = [];
	var stack = this.stack = [];
	var sp = 0;
	
    this.parseBC = function(inbc) {
		var entry = new Func();
		var curf = entry;
		
		for(var i in inbc) {
	        curf.addCommand(inbc[i]);
		}
		
		//return entry;
		return entry.getInstance();
	};

	
	var Interface = function() {
		this.defs = [];
		this.aproto = [];
		this.Proto = function() {};
		this.dict = {};
		this.size = 0;
	};
	
	Interface.prototype.add = function(key, type, def) {
		var n = this.size;
		
		this.defs.push([key, type]);
		
		this.dict[key] = n;
		this.size++;
		
		var tflag = type[0];
		
		var is_float = tflag == 'f';
		var is_sint = tflag == 'i';
		var is_uint = tflag == 'u';

		if(is_float) def = parseFloat(def || 0);
		else if(is_sint || is_uint) def = parseInt(def || 0);
		
		this.aproto[n] = def;
		this.Proto.prototype[key] = def;
		
		return n;
	};
	
	Interface.prototype.create = function() {
		//return this.proto.concat();
		return new this.Proto;
	};
	
	var Command = function(_cmd) {
		var parts = _cmd.split('=');
        var ret = null, fcmd;

        if(parts.length > 1) {
            ret = parts[0].trim();
            fcmd = parts[1].trim();
        } else
            fcmd = parts[0].trim();
           
        _cmd = fcmd.split(' ');
		
		var cmd = _cmd[0];
		var args = _cmd.splice(1);

	    this.ret = ret;
	    this.cmd = cmd;
	    this.nargs = args ? args.length : 0;
	    this.types = [];
	    
	    if(args) for(var i in args) {
            this[i] = args[i];
            
            var sp = this[i].split('+');
            
            this.types[i] = 'v';
            
            if(sp.length > 1) {
                this[i] = sp;
                this.types[i] = 'off';
                
                if(this[i][1][0] == '"')
                    this[i][1] = JSON.parse(this[i][1]);
            } else if(this[i][0] == '$') {
            	this.types[i] = 'reg';
            } else if(this[i] == 'v') {
            	this.types[i] = 'lval';
            }
	    }
	        
	    switch(cmd) {
	    	case 'add':
                if(this.types[0] == 'v') this[0] = JSON.parse(this[0]);
                if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
                
                this.run = function(func) {
                    var a = func.getValue(null, 0, this);
                    var b = func.getValue(null, 1, this);
                    
                    return a + b;
                };
                break;
	    	case 'int':
	    	    this.run = function(func) {
	                return new Interface();
	    	    };
	    	    break;
            case 'new':
                this.run = function(func) {
                    var inf = func.getValue(null, 0, this);
                    return inf.create();
                };
                break;
            case 'prop':
                if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
                
                this.run = function(func) {
                    var obj = func.getValue(null, 0, this);
                    var v = func.getValue(null, 1, this);
                    
                    //return inf.dict[v];
                    return v;
                };
                break;
            case 'return':
                this.run = function(func) {
                    var ret = func.getValue(null, 0, this);
                    return func.doRet(ret);
                };
                break;
            case 'set':
                if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
                
                this.run = function(func) {
                    var obj = this[0];
                    var from = func.getValue(null, 1, this);
                    var off = 0;
                    
                    if(this.types[0] == 'off') {
                    	off = func.getValue(obj[1], null, this);
                    	obj = func.getValue(obj[0], null, this);
                    } else
                        obj = func.getValue(obj, null, this);
                    
                    if(off === 'v')
                        off = func.value;
                    
                    obj[off] = from;
                };
                break;
            case 'sub':
                if(this.types[0] == 'v') this[0] = JSON.parse(this[0]);
                if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
                
                this.run = function(func) {
                    var a = func.getValue(null, 0, this);
                    var b = func.getValue(null, 1, this);
                    
                    return a - b;
                };
                break;
            case 'var':
                if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
                
                this.run = function(func) {
                    var inf = func.getValue(null, 0, this);
                    return inf.add(func.getValue(null, 1, this), func.getValue(null, 2, this),
                       this.nargs == 4 ? func.getValue(null, 3, this) : undefined);
                };
                break;
	    }
	};
	
	var Func = function() {
	    this.commands = [];
	    this.curcummands = this.commands;
	    this.value = undefined;
	    //this.regs = {};
	    this.doRet = null;

	    this.Proto = function() {
            /*
             * this function instance keeps REFERENCES to all properties that are
             * arrays or objects. Registers and 'value' are thus copy on write.
            * */
            this.isDef = false;
            this.Proto = null;
	    };

	    this.Proto.prototype = this;
	};

    Func.prototype.getInstance = function() {
    	return new this.Proto;
    };

	Func.prototype.addCommand = function(cmd) {
		var c = new Command(cmd);
		this.commands.push(c);
	};
	
	Func.prototype.getValue = function(v, i, cmd) {
        var func = this;
        var type = 'v';
        var regs = func;
        
        if(v === null) {
            v = cmd[i];
            type = cmd.types[i];
        } else if(v[0] === '$') {
            type = 'reg';
        }
        
        if(cmd[i] === 'v')
            return func.value;
        
        if(type === 'reg')
            return regs[v];
            
        if(type === 'off') {
            var off = v[1];
            if(off === 'v')
               off = func.value;
               
            return v[0][off];
        }
          
        return v;
    };

	Func.prototype.run = function() {
		var idx = 0;
		var regs = this;
		var fret = undefined;
		var cs = this.commands.length;
		
		this.doRet = function(v) {
			fret = v;
			idx = cs + 1;
		};
	
		while(idx < cs) {
			var cmd = this.commands[idx];
			
			//nop
			if(!cmd) continue;

			var r = cmd.run(this);
			
			if(cmd.ret)
			    regs[cmd.ret] = r;
			else
                this.value = r;
			
			idx++;
		}
		
		return fret;
	};
}



var bc = [
'$1 = int',
'var $1 "pa" i32 0',
'var $1 "pb" i32 0',
'$2 = new $1',
'$3 = prop $2 "pa"',
'add 5 2',
'sub v 22',
'set $2+$3 v',
'prop $2 "pb"',
'set $2+v 23',
'set $2+"pb" 99',
'return $2'
];

var morph = new Morph();

var main = morph.parseBC(bc);

console.log(morph, main);

var ret = main.run();

console.log(ret);

console.log(morph, main);