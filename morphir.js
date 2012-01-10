/*
 * (C) Colin Godsey 2011
 * 
 * Distributed under GPL v3.0 (see LICENSE). 
 * 
 * All headers must be maintained.
 */

/**
 * @const
 */
var MORPH_USE_OFFSETS = true;

function Morph() {
    var bc = this.bc = [];
    var stack = this.stack = [];
    var sp = 0;
    
    this.createFunctionFromBC = function(inbc) {
        var entry = new Func();
        var curf = entry;
        
        for(var i in inbc) {
        	if(inbc[i][0] == ':')
        	    curf.addLabel(inbc[i]);
        	else
                curf.addCommand(inbc[i]);
        }
   
        return entry.getInstance();
    };

    
    var Interface = function() {
        this.defs = [];
        this.aproto = [this];
        this.Proto = function() {};
        this.dict = {};
        this.size = this.aproto.length;
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
        return MORPH_USE_OFFSETS ? this.aproto.concat() : new this.Proto;
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
            
            var pi;
            
            if(sp.length > 1) {
                this[i] = sp;
                this.types[i] = 'off';
                
                if(this[i][1][0] == '"')
                    this[i][1] = JSON.parse(this[i][1]);
            } else if(this[i][0] == '$') {
                this.types[i] = 'reg';
            } else if(this[i] == 'v') {
                this.types[i] = 'lval';
            } else if((pi = parseInt(this[i])) == this[i]) {
            	this.types[i] = 'num';
            	this[i] = pi;
           } else if(this[i][1][0] == '"') {
                this[i] = JSON.parse(this[i]);
                this.types[i] = 'json';
            }
        }
            
        switch(cmd) {
        case 'add':
            if(this.types[0] == 'v') this[0] = JSON.parse(this[0]);
            if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
            
            this.render = function(func) {
            	var a = func.renderValue(null, 0, this);
            	var b = func.renderValue(null, 1, this);
            	
            	return '(' + a + '+' + b + ')';
            };
            
            this.run = function(func) {
                var a = func.getValue(null, 0, this);
                var b = func.getValue(null, 1, this);
                
                return a + b;
            };
            break;
        case 'const':
            if(this.types[0] == 'v') this[0] = JSON.parse(this[0]);
            
            this.run = function(func) {
                return this[0];
            };
            
            this.render = function(func, lastRet) {
                return this[0];
            };
            
            break;
        case 'get':
            this.run = function(func) {
                var obj = this[0];
                var off = 0;
                
                if(this.types[0] == 'off') {
                    off = func.getValue(obj[1], null, this);
                    obj = func.getValue(obj[0], null, this);
                } else
                    obj = func.getValue(obj, null, this);
                
                if(off === 'v')
                    off = func.value;
                
                return obj[off];
            };
            
            this.render = function(func) {
                var obj = this[0];
                var off = 0;
                
                if(this.types[0] == 'off') {
                    off = func.renderValue(obj[1], null, this);
                    obj = func.renderValue(obj[0], null, this);
                } else
                    obj = func.renderValue(obj, null, this);
                
                if(off === '"v"') {
                    off = func.value;
                    func.valRead = true;
                }
                
                return obj + "[" + off + "]";
            };
            break;
        case 'int':
            this.run = function(func) {
                return new Interface();
            };
            
            this.render = function(func) {
                return MORPH_USE_OFFSETS ? '{}' : '(function(){})';
            };
            
            break;
        case 'jp':
            this.run = function(func) {
            	var v = func.getValue(null, 1, this);
            	var off = this[2];
            	
                switch(this[0]) {
            	case 'ifnz':
            	   if(v !== 0)
            	       func.goTo(off);
            	   break;
                }
            };
            
            this.render = function(func) {
                return;
            };
            
            break;
        case 'new':
            this.run = function(func) {
                var inf = func.getValue(null, 0, this);
                return inf.create();
            };
            
            this.render = function(func) {
                var inf = func.renderValue(null, 0, this);
                return MORPH_USE_OFFSETS ? 
                    '(__=new Array(' + func.getValue(null, 0, this).size + '),__[0]=' + inf + ',__)' : 
                    'new ' + func.renderValue(null, 0, this);
            };
            break;
        case 'prop':
            if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
            
            this.run = function(func) {
                var obj = func.getValue(null, 0, this);
                var v = func.getValue(null, 1, this);
                
                var inf = obj[0];
                
                return MORPH_USE_OFFSETS ? inf.dict[v] : v;
            };
            
            this.render = function(func) {
                var obj = func.getValue(null, 0, this);
                var v = func.getValue(null, 1, this);
                
                var inf = obj[0];
                
                if(MORPH_USE_OFFSETS)
                    return inf.dict[v];
                else
                    return JSON.stringify(v);
            };
            break;
        case 'return':
            this.run = function(func) {
                var ret = func.getValue(null, 0, this);
                return func.doRet(ret);
            };
            
            this.render = function(func) {
                var ret = func.renderValue(null, 0, this);
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
            
            this.render = function(func) {
                var obj = this[0];
                var from = func.renderValue(null, 1, this);
                var off = 0;
                
                if(this.types[0] == 'off') {
                    off = func.renderValue(obj[1], null, this);
                    obj = func.renderValue(obj[0], null, this);
                } else
                    obj = func.renderValue(obj, null, this);
                
                if(off === '"v"') {
                    off = func.value;
                    func.valRead = true;
                }
                
                if(off[0] == '"')
                    return obj + "." + JSON.parse(off) + "=" + from;
                
                return obj + "[" + off + "]=" + from;
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
            
            this.render = function(func) {
                var a = func.renderValue(null, 0, this);
                var b = func.renderValue(null, 1, this);
                
                return '(' + a + '-' + b + ')';
            };
            break;
        case 'var':
            if(this.types[1] == 'v') this[1] = JSON.parse(this[1]);
            
            this.run = function(func) {
                var inf = func.getValue(null, 0, this);
                return inf.add(func.getValue(null, 1, this), func.getValue(null, 2, this),
                   this.nargs == 4 ? func.getValue(null, 3, this) : undefined);
            };
            
            this.render = function(func) {
                var inf = func.getValue(null, 0, this);
                var key = func.renderValue(null, 1, this);
                var type = func.renderValue(null, 2, this);
                var def = this.nargs == 4 ? func.renderValue(null, 3, this) : undefined;
                
                var off = inf.dict[func.getValue(null, 1, this)];
                
                if(MORPH_USE_OFFSETS) {
                	off = key;
                	
                	return;
                }
                
                if(MORPH_USE_OFFSETS && key[0] == '"')
                    return func.renderValue(null, 0, this) + ".prototype." + JSON.parse(key) + "=" + def;
                
                return func.renderValue(null, 0, this) + ".prototype[" + off + "]=" + def;
            };
            break;
        }
    };
    
    var Func = function() {
        this.commands = [];
        this.curcummands = this.commands;
        this.value = undefined;
        this.labels = {};
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

    Func.prototype.addLabel = function(l) {
        this.labels[l] = this.commands.length;
    };

    Func.prototype.addCommand = function(cmd) {
        var c = new Command(cmd);
        this.commands.push(c);
    };
    
    Func.prototype.renderValue = function(v, i, cmd) {
        var func = this;
        var type = 'v';
        var regs = func;
        
        if(v === null) {
            v = cmd[i];
            type = cmd.types[i];
        } else if(v[0] === '$') {
            type = 'reg';
        }
        
        if(cmd[i] === 'v') {
        	func.valRead = true;
            return func.value;
        }
        
        if(type === 'reg')
            return v;
            
        if(type === 'off') {
            var off = v[1];
            if(off === 'v') {
               off = func.value;
               func.valRead = true;
            }
               
            return v[0] + '[' + off + ']';
        }

        return JSON.stringify(v);
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
    
    Func.prototype.render = function() {
        var out = [];
        var full_out = [];
        var idx = 0;
        var regs = this;
        var fret = undefined;
        var cs = this.commands.length;
        var vars = {};

        this.value = undefined;
        this.valRead = true;
        
        this.doRet = function(v) {
            fret = v;
            idx = cs + 1;
        };
        
        for(var i in this.curcummands) {
            var cmd = this.curcummands[i];

            var rval = cmd.run(this);
            var r = cmd.render(this);
            full_out.push(r);
            
            if(!this.valRead) {
                out.push(this.value + ';');
                this.valRead = true;
            }
            
            if(!r) continue;
            
            if(cmd.ret) {
                var pre = "";
                if(!vars[cmd.ret]) {
                	vars[cmd.ret] = true;
                	pre = "var ";
                }
                regs[cmd.ret] = rval;
                out.push(pre + cmd.ret + "=" + r + ';');
                this.value = undefined;
                this.valRead = true;
            } else {
                this.value = r;
                this.valRead = false;
            }
            
            //out.push(o);
        }
        
        return out;
    };

    Func.prototype.run = function() {
        var idx = 0;
        var regs = this;
        var fret = undefined;
        var cs = this.commands.length;
        
        //this can be unset later...
        this.value = undefined;
        
        this.doRet = function(v) {
            fret = v;
            idx = cs + 1;
        };
        
        this.goTo = function(l) {
            idx = this.labels[l];
        };
    
        while(idx < cs) {
            var cmd = this.commands[idx];
            
            //nop
            if(!cmd) continue;

            var r = cmd.run(this);
            
            if(cmd.ret) {
                regs[cmd.ret] = r;
                
                //this can get removed later....
                this.value = undefined;
            } else
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
'$4 = const 500',

':loop',
'$2 = new $1',
'$3 = prop $2 "pa"',
'add 5 2',
'sub v 22',
'set $2+$3 v',
'prop $2 "pb"',
'set $2+v 23',
'get $2+$3',
'$1 = add v 99',
//'set $2+"pb" v',
'prop $2 "pb"',
'set $2+v $1',
'$4 = sub $4 1',
'jp ifnz $4 :loop',

'return $2'
];

var morph = new Morph();

var main = morph.createFunctionFromBC(bc);

console.log(morph, main);

function time_it(f) {
	for(var i = 0 ; i < 100 ; i++)
       f();
	
	var st = +new Date;
	var cnt = 1000;
	
	for(var i = 0 ; i < cnt ; i++)
	   f();
	
	var dt = +new Date - st;
	var rate = dt / cnt;
	
	return rate;
}

var ret;

var intt = time_it(function() {
    ret = main.run();
});

console.log("run took " + intt);

console.log(ret);
console.log(main.render().join("\n"));

console.log(morph, main);

//PREAMBLE

var __;

//END PREAMBLE

var out;
//var jt = time_it(new Function(main.render().join("\n")+'out=$2;'));
function ff() {
	var $1={};
	var $4=500;
	while($4 !== 0) {
		var $2=(__=new Array(3),__[0]=$1,__);
        var $3=1;
		$2[$3]=((5+2)-22);
		$2[2]=23;
		$1=($2[$3]+99);
		$2[2]=$1;
		$4=($4-1);
	}
}

function ffkey() {
    var $1=(function(){});
    $1.prototype[1]=0;
    $1.prototype[2]=0;
    var $4=500;
    while($4 !== 0) {
        var $2=new $1;
        var $3="pa";
        $2[$3]=((5+2)-22);
        $2.pb=23;
        var $5=($2[$3]+99);
        $2.pb=$5;
        $4=($4-1);
    }
}

var jt = time_it(ff);
console.log("out took " + jt);

console.log("ratio " + (intt / jt));

console.log(out);