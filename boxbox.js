window.BB = (function() {
    
    // Make sure Box2D exists
    if (Box2D === undefined) {
        console.error('boxbox needs Box2d to work');
        return;
    }
    
    // Object creation inspired by Crockford
    // http://javascript.crockford.com/prototypal.html
    function create(o) {
        function F() {}
        F.prototype = o;
        return new F();
    }
    
    // A minimal extend for simple objects inspired by jQuery
    function extend(target, o) {
        if (target === undefined) {
            target = {};
        }
        if (o !== undefined) {
            for (var key in o) {
                if (o.hasOwnProperty(key) && target[key] === undefined) {
                    target[key] = o[key];
                }
            }
        }
        return target;
    }

    // Standard imports. TODO mechanism for custom imports
    var b2Vec2 = Box2D.Common.Math.b2Vec2;
    var b2BodyDef = Box2D.Dynamics.b2BodyDef;
    var b2Body = Box2D.Dynamics.b2Body;
    var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
    var b2Fixture = Box2D.Dynamics.b2Fixture;
    var b2World = Box2D.Dynamics.b2World;
    var b2MassData = Box2D.Collision.Shapes.b2MassData;
    var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
    
    // BB methods
        
    this.createWorld = function(canvasElem, ops) {
        var world = create(World);
        world._init(canvasElem, ops);
        return world;
    }
    
    var WORLD_DEFAULT_OPTIONS = {
        gravity: 10,
        allowSleep: true
    }

    var World = {
        
        _ops: null,
        _world: null,
        _canvas: null,
        _keydownHandlers: {},
        _keyupHandlers: {},
        _impulseQueue: [],
        _constantVelocities: {},
        _constantForces: {},
        _entities: {},
        _nextEntityId: 0,
        
        _init: function(canvasElem, options) {
            var self = this;
            var key;
            var i;
            this._ops = extend(options, WORLD_DEFAULT_OPTIONS);
            this._world = new b2World(new b2Vec2(0, this._ops.gravity), true);
            this._canvas = canvasElem;
            
            // Set up rendering on the provided canvas
            if (this._canvas !== undefined) {
                var world = this._world;
                
                var debugDraw = new b2DebugDraw();
                debugDraw.SetSprite(this._canvas.getContext("2d"));
                debugDraw.SetDrawScale(30.0);
                debugDraw.SetFillAlpha(0.3);
                debugDraw.SetLineThickness(1.0);
                debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
                world.SetDebugDraw(debugDraw);
                
                (function animationLoop(){

                    // set velocities for this step
                    for (key in self._constantVelocities) {
                        var v = self._constantVelocities[key];
                        v.body.SetLinearVelocity(new b2Vec2(v.x, v.y),
                                                 v.body.GetWorldCenter());
                    }

                    // apply impulses for this step
                    for (i = 0; i < self._impulseQueue.length; i++) {
                        var impulse = self._impulseQueue.pop()
                        impulse.body.ApplyImpulse(new b2Vec2(impulse.x, impulse.y),
                                                  impulse.body.GetWorldCenter());
                    }               
                    
                    // set forces for this step
                    for (key in self._constantForces) {
                        var f = self._constantForces[key];
                        f.body.ApplyForce(new b2Vec2(f.x, f.y),
                                          f.body.GetWorldCenter());
                    }

                    // framerate, velocity iterations, position iterations
                    world.Step(1 / 60, 10, 10);
                    world.ClearForces();
                    world.DrawDebugData();

                    // TODO paul irish shim
                    window.webkitRequestAnimationFrame(animationLoop);
                })();
                
                var body = document.getElementsByTagName('body')[0];
                body.addEventListener('keydown', function(e) {
                    for (var key in self._keydownHandlers) {
                        self._keydownHandlers[key].call(self._entities[key], e);
                    }
                }, false);
                body.addEventListener('keyup', function(e) {
                    for (var key in self._keyupHandlers) {
                        self._keyupHandlers[key].call(self._entities[key], e);
                    }
                }, false);
            }
        },
        
        _addKeydownHandler: function(id, f) {
            this._keydownHandlers[id] = f;
        },
        
        _addKeyupHandler: function(id, f) {
            this._keyupHandlers[id] = f;
        },

        _applyImpulse: function(id, body, x, y) {
          this._impulseQueue.push({
                id:id,
                body:body,
                x:x,
                y:y
            });
        },
        
        _setConstantVelocity: function(id, body, x, y) {
            this._constantVelocities[id] = {
                body:body,
                x:x,
                y:y
            };
        },
        
        _setConstantForce: function(id, body, x, y) {
            this._constantForces[id] = {
                body:body,
                x:x,
                y:y
            };
        },
        
        gravity: function(value) {
            if (value !== undefined) {
                this._world.SetGravity(new b2Vec2(0, this._ops.gravity))
            }
            var v = this._body.GetGravity();
            return {x: v.x, y: v.y};
        },
        
        createEntity: function(o) {
            var entity = create(Entity);
            var id = this._nextEntityId++;
            entity._init(this, o, id);
            this._entities[id] = entity;
            return entity;
        }
        
    };
    
    var ENTITY_DEFAULT_OPTIONS = {
        x: 10,
        y: 5,
        type: 'dynamic', // or static
        shape: 'box', // or circle or polygon
        height: 1, // for box
        width: 1, // for box
        radius: 1, // for circle
        points: [{x:0, y:0}, // for polygon
                 {x:2, y:0},
                 {x:0, y:2}], 
        density: 1,
        friction: .2,
        restitution: .2, // bounciness
        active: true, // participates in collision and dynamics
        fixedRotation: false,
        bullet: false // perform expensive continuous collision detection
    };
    
    var Entity = {
        
        _id: null,
        _ops: null,
        _body: null,
        _world: null,
        
        _init: function(world, options, id) {
            this._ops = extend(options, ENTITY_DEFAULT_OPTIONS);
            var ops = this._ops;
            
            this._body = new b2BodyDef;
            var body = this._body;
            
            this._world = world;
            this._id = id;
            
            var fixture = new b2FixtureDef;
            fixture.density = ops.density;
            fixture.friction = ops.friction;
            fixture.restitution = ops.restitution;

            
            body.position.x = ops.x;
            body.position.y = ops.y;
            
            // type
            if (ops.type === 'static') {
                body.type = b2Body.b2_staticBody;
            }
            else if (ops.type === 'dynamic') {
                body.type = b2Body.b2_dynamicBody;
            }
            
            // shape
            if (ops.shape === 'box') {
                fixture.shape = new b2PolygonShape;
                fixture.shape.SetAsBox(ops.width, ops.height);
            }
            else if (ops.shape === 'circle') {
                fixture.shape = new b2CircleShape(ops.radius);
            }
            else if (ops.shape === 'polygon') {
                fixture.shape = new b2PolygonShape;
                fixture.shape.SetAsArray(ops.points, ops.points.length);
            }
            
            body.active = ops.active;
            body.fixedRotation = ops.fixedRotation;
            body.bullet = ops.bullet;
            
            this._body = world._world.CreateBody(body); 
            this._body.CreateFixture(fixture);
        },
        
        position: function(value) {
            if (value !== undefined) {
                this._body.SetPosition(new b2Vec2(value.x, value.y));
            }
            var v = this._body.GetPosition();
            return {x: v.x, y: v.y};
        },
        
        velocity: function(value) {
            if (value !== undefined) {
                this._body.SetLinearVelocity(new b2Vec2(value.x, value.y));
            }
            var v = this._body.GetLinearVelocity();
            return {x: v.x, y: v.y};
        },

        // returns a vector. params can be either of the following:
        // power, x, y
        // power, degrees
        _toVector: function(power, a, b) {
            var x;
            var y;
            a = a || 0;
            if (b === undefined) {
                a -= 90;
                x = Math.cos(a * (Math.PI / 180)) * power;
                y = Math.sin(a * (Math.PI / 180)) * power;
            }
            else {
                x = a;
                y = b;
            }
            return {x:x,y:y};
        },
        
        applyImpulse: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._applyImpulse(this._id, this._body, v.x, v.y);
        },
        
        setForce: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantForce(this._id, this._body, v.x, v.y);
        },
        
        setVelocity: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantVelocity(this._id, this._body, v.x, v.y);
        },
        
        onKeydown: function(f) {
            this._world._addKeydownHandler(this._id, f);
        },
        
        onKeyup: function(f) {
            this._world._addKeyupHandler(this._id, f);
        }
        
    }
    
    return this;

})();
