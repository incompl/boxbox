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

    // these look like imports but there is no cost here
    var b2Vec2 = Box2D.Common.Math.b2Vec2;
    var b2Math = Box2D.Common.Math.b2Math;
    var b2BodyDef = Box2D.Dynamics.b2BodyDef;
    var b2Body = Box2D.Dynamics.b2Body;
    var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
    var b2Fixture = Box2D.Dynamics.b2Fixture;
    var b2World = Box2D.Dynamics.b2World;
    var b2MassData = Box2D.Collision.Shapes.b2MassData;
    var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
    var b2AABB = Box2D.Collision.b2AABB;
    
    // BB methods
        
    this.createWorld = function(canvasElem, ops) {
        var world = create(World);
        world._init(canvasElem, ops);
        return world;
    }
    
    var WORLD_DEFAULT_OPTIONS = {
        gravity: 10,
        allowSleep: true,
        scale: 30
    }

    var World = {
        
        _ops: null,
        _world: null,
        _canvas: null,
        _keydownHandlers: {},
        _keyupHandlers: {},
        _startContactHandlers: {},
        _finishContactHandlers: {},
        _impactHandlers: {},
        _destroyQueue: [],
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
            this._ctx = this._canvas.getContext("2d");
            this._scale = this._ops.scale;
            
            // Set up rendering on the provided canvas
            if (this._canvas !== undefined) {
                var world = this._world;
                
                // debug rendering
                if (this._ops.debugDraw) {
                    var debugDraw = new b2DebugDraw();
                    debugDraw.SetSprite(this._canvas.getContext("2d"));
                    debugDraw.SetDrawScale(this._scale);
                    debugDraw.SetFillAlpha(0.3);
                    debugDraw.SetLineThickness(1.0);
                    debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
                    world.SetDebugDraw(debugDraw);
                }
                
                // animation loop
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
                    
                    // render stuff
                    self._canvas.width = self._canvas.width;
                    for (key in self._entities) {
                      entity = self._entities[key];
                      entity._draw(self._ctx,
                                   entity._body.m_xf.position.x,
                                   entity._body.m_xf.position.y);
                    }
                    
                    // destroy
                    for (i = 0; i < self._destroyQueue.length; i++) {
                        var toDestroy = self._destroyQueue.pop();
                        var id = toDestroy._id;
                        world.DestroyBody(toDestroy._body);
                        delete self._keydownHandlers[id];
                        delete self._startContactHandlers[id];
                        delete self._finishContactHandlers[id];
                        delete self._impactHandlers[id];
                        delete self._destroyQueue[id];
                        delete self._impulseQueue[id];
                        delete self._constantVelocities[id];
                        delete self._constantForces[id];
                        delete self._entities[id];
                    }
                    
                    world.ClearForces();
                    world.DrawDebugData();

                    // TODO paul irish shim
                    window.webkitRequestAnimationFrame(animationLoop);
                })();
                
                // keyboard events
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

                // contact events
                listener = new Box2D.Dynamics.b2ContactListener;
                listener.BeginContact = function(contact) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    for (var key in self._startContactHandlers) {
                        if (a._id === Number(key)) {
                            self._startContactHandlers[key].call(self._entities[key], b);
                        }
                        if (b._id === Number(key)) {
                            self._startContactHandlers[key].call(self._entities[key], a);
                        }
                    }
                }
                listener.EndContact = function(contact) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    for (var key in self._finishContactHandlers) {
                        if (a._id === Number(key)) {
                            self._finishContactHandlers[key].call(self._entities[key], b);
                        }
                        if (b._id === Number(key)) {
                            self._finishContactHandlers[key].call(self._entities[key], a);
                        }
                    }
                }
                listener.PostSolve = function(contact, impulse) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    
                    for (var key in self._impactHandlers) {
                        if (a._id === Number(key)) {
                            self._impactHandlers[key].call(self._entities[key],
                                                           b,
                                                           impulse.normalImpulses[0],
                                                           impulse.tangentImpulses[0]);
                        }
                        if (b._id === Number(key)) {
                            self._impactHandlers[key].call(self._entities[key],
                                                           a,
                                                           impulse.normalImpulses[0],
                                                           impulse.tangentImpulses[0]);
                        }
                    }
                }
                world.SetContactListener(listener);
            }
        },
        
        _addKeydownHandler: function(id, f) {
            this._keydownHandlers[id] = f;
        },
        
        _addKeyupHandler: function(id, f) {
            this._keyupHandlers[id] = f;
        },

        _addStartContactHandler: function(id, f) {
            this._startContactHandlers[id] = f;
        },
        
        _addFinishContactHandler: function(id, f) {
            this._finishContactHandlers[id] = f;
        },

        _addImpactHandler: function(id, f) {
            this._impactHandlers[id] = f;
        },
        
        _destroy: function(obj) {
            this._destroyQueue.push(obj);
        },

        _applyImpulse: function(id, body, x, y) {
          this._impulseQueue.push({
                id:id,
                body:body,
                x:x,
                y:y
            });
        },
        
        _setConstantVelocity: function(name, id, body, x, y) {
            this._constantVelocities[name + id] = {
                id:id,
                body:body,
                x:x,
                y:y
            };
        },
        
        _clearConstantVelocity: function(name, id) {
            delete this._constantVelocities[name + id];
        },

        _setConstantForce: function(name, id, body, x, y) {
            this._constantForces[name + id] = {
                id:id,
                body:body,
                x:x,
                y:y
            };
        },
        
        _clearConstantForce: function(name, id) {
            delete this._constantForces[name + id];
        },

        gravity: function(value) {
            if (value !== undefined) {
                this._world.SetGravity(new b2Vec2(0, this._ops.gravity))
            }
            var v = this._body.GetGravity();
            return {x: v.x, y: v.y};
        },
        
        createEntity: function() {
            var o = {};
            var args = Array.prototype.slice.call(arguments);
            args.reverse();
            for (var key in args) {
                extend(o, args[key]);
            }
            var entity = create(Entity);
            var id = this._nextEntityId++;
            entity._init(this, o, id);
            this._entities[id] = entity;
            return entity;
        },

        find: function(x1, y1, x2, y2) {
            if (x2 === undefined) {
                x2 = x1;
            }
            if (y2 === undefined) {
                y2 = y1;
            }
            var self = this;
            var result;
            var aabb = new b2AABB();
            aabb.lowerBound.Set(x1, y1);
            aabb.upperBound.Set(x2, y2);
            this._world.QueryAABB(function(fixt) {
                result = self._entities[fixt.GetBody()._bbid];
            }, aabb);
            return result;
        },

        findAll: function(x1, y1, x2, y2) {
            if (x2 === undefined) {
                x2 = x1;
            }
            if (y2 === undefined) {
                y2 = y1;
            }
            var self = this;
            var result = [];
            var aabb = new b2AABB();
            aabb.lowerBound.Set(x1, y1);
            aabb.upperBound.Set(x2, y2);
            this._world.QueryAABB(function(fixt) {
                result.push(self._entities[fixt.GetBody()._bbid]);
                return true;
            }, aabb);
            return result;
        }
        
    };
    
    var ENTITY_DEFAULT_OPTIONS = {
        name: 'unnamed object',
        x: 10,
        y: 5,
        type: 'dynamic', // or static
        shape: 'square', // or circle or polygon
        height: 1, // for box
        width: 1, // for box
        radius: 1, // for circle
        points: [{x:0, y:0}, // for polygon
                 {x:2, y:0},
                 {x:0, y:2}], 
        density: 2,
        friction: 1,
        restitution: .2, // bounciness
        active: true, // participates in collision and dynamics
        fixedRotation: false,
        bullet: false, // perform expensive continuous collision detection
        image: null,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageStretchToFit: null,
        draw: function(ctx, x, y) {
            ctx.fillStyle = this._ops.color || 'gray';
            ctx.strokeStyle = 'black';
            var i;
            var scale = this._world._scale;
            var ox = this._ops.imageOffsetX || 0;
            var oy = this._ops.imageOffsetY || 0;
            if (this._sprite !== undefined) {
                var width;
                var height;
                if (this._ops.radius) {
                    width = height = this._ops.radius * 2 * scale;
                    x -= this._ops.radius / 2;
                    y -= this._ops.radius / 2;
                }
                else if (this._ops.imageStretchToFit) {
                    width = this._ops.width * scale * 2;
                    height = this._ops.height * scale * 2;
                }
                else {
                    width = this._sprite.width * scale / 30;
                    height = this._sprite.height * scale / 30;
                }
                //ctx.translate(x * scale, y * scale);
                //ctx.rotate(this._body.GetAngle());
                ctx.drawImage(this._sprite,
                              (x + ox) * scale - this._ops.width * scale,
                              (y + oy) * scale - this._ops.height * scale,
                              width,
                              height);
                //ctx.rotate(0 - this._body.GetAngle());
                //ctx.translate(0 - (x * scale), 0 - (y * scale));
            }
            else if (this._ops.shape === 'square') {
                var sx = x * scale - this._ops.width * scale;
                var sy = y * scale - this._ops.height * scale;
                var sw = this._ops.width * scale * 2;
                var sh = this._ops.height * scale * 2;
                ctx.strokeRect(sx, sy, sw, sh);
                ctx.fillRect(sx, sy, sw, sh);
            }
            else if (this._ops.shape === 'polygon') {
                var i = 0;
                var poly = this._body.GetFixtureList().GetShape();;
                var vertexCount = parseInt(poly.GetVertexCount());
                var localVertices = poly.GetVertices();
                var vertices = new Vector(vertexCount);
                var xf = this._body.m_xf;
                for (i = 0; i < vertexCount; ++i) {
                   vertices[i] = b2Math.MulX(xf, localVertices[i]);
                }
                ctx.beginPath();
                ctx.moveTo((vertices[0].x) * scale, (vertices[0].y) * scale);
                for (i = 1; i < vertices.length; i++) {
                    ctx.lineTo((vertices[i].x) * scale, (vertices[i].y) * scale);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
            else if (this._ops.shape === 'circle') {
                var p = this.position();
                ctx.beginPath();
                ctx.arc(p.x * scale,
                        p.y * scale,
                        this._ops.radius * scale,
                        0,
                        Math.PI * 2, true);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
        }
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
            
            this.name = ops.name;

            // type
            if (ops.type === 'static') {
                body.type = b2Body.b2_staticBody;
            }
            else if (ops.type === 'dynamic') {
                body.type = b2Body.b2_dynamicBody;
            }
            
            // shape
            if (ops.shape === 'square') {
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
            
            // rendering stuff
            if (ops.draw) {
                this._draw = ops.draw;
            }
            if (ops.image) {
                this._sprite = new Image();
                this._sprite.src = ops.image;
            }
            
            body.active = ops.active;
            body.fixedRotation = ops.fixedRotation;
            body.bullet = ops.bullet;
            
            this._body = world._world.CreateBody(body); 
            this._body.CreateFixture(fixture);
            this._body._bbid = id;
            
            // events
            if (ops.onStartContact) {
                this._world._addStartContactHandler(id, ops.onStartContact);
            }
            if (ops.onFinishContact) {
                this._world._addFinishContactHandler(id, ops.onFinishContact);
            }
            if (ops.onImpact) {
                this._world._addImpactHandler(id, ops.onImpact);
            }
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
        
        position: function(value) {
            if (value !== undefined) {
                this._body.SetPosition(new b2Vec2(value.x, value.y));
            }
            var v = this._body.GetPosition();
            return {x: v.x, y: v.y};
        },
        
        rotation: function(value) {
            if (value !== undefined) {
                this._body.SetAngle(value);
            }
            return this._body.GetAngle();
        },
        
        friction: function(value) {
            if (value !== undefined) {
                this._body.GetFixtureList().SetFriction(value);
            }
            return this._body.GetFixtureList().GetFriction();
        },
        
        destroy: function() {
            this._destroyed = true;
            this._world._destroy(this);
        },

        applyImpulse: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._applyImpulse(this._id, this._body, v.x, v.y);
        },
        
        setForce: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantForce(name, this._id, this._body, v.x, v.y);
        },
        
        setVelocity: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantVelocity(name, this._id, this._body, v.x, v.y);
        },

        clearForce: function(name) {
            this._world._clearConstantForce(name, this._id);
        },

        clearVelocity: function(name) {
            this._world._clearConstantVelocity(name, this._id);
        },
        
        onKeydown: function(f) {
            this._world._addKeydownHandler(this._id, f);
        },
        
        onKeyup: function(f) {
            this._world._addKeyupHandler(this._id, f);
        },

        onStartContact: function(f) {
            this._world._addStartContactHandler(this._id, f);
        },

        onFinishContact: function(f) {
            this._world._addFinishContactHandler(this._id, f);
        },

        onImpact: function(f) {
            this._world._addImpactHandler(this._id, f);
        }
        
    }
    
    return this;

})();