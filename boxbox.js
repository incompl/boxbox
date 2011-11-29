/**
 * @header boxbox api documentation
 */

/**
 * @description global boxbox object
 */
window.boxbox = (function() {
    
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
    
    /**
     * @module boxbox
     * @param canvas element to render on
     * @param options object
     * @return a boxbox World object
     */
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

    /**
     * @header
     * @description contains a single self-contained physics simulation
     */
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
        _cameraX: 0,
        _cameraY: 0,
        _onRender: function(){},
        
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
                    debugDraw.SetDrawScale(this._scale); // TODO update this if changed?
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
                    self._onRender.call(self, self._ctx);
                    
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

        /**
         * @module world
         * @param new value (optional)
         * @description Get or set the world's gravity. Negative values allowed.
         */
        gravity: function(value) {
            if (value !== undefined) {
                this._world.SetGravity(new b2Vec2(0, value))
            }
            var v = this._world.GetGravity();
            return {x: v.x, y: v.y};
        },
        
        /**
         * @module world
         * @param options object
         * @return a new entity
         */
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
        
        createJoint: function(type, e1, e2, options) {
            options = options || {};
            var joint;
            
            if (type === "distance") {
                joint = new Box2D.Dynamics.Joints.b2DistanceJointDef();
            }
            else if (type === "revolute") {
                joint = new Box2D.Dynamics.Joints.b2RevoluteJointDef();
            }
            else if (type === "gear") {
                joint = new Box2D.Dynamics.Joints.b2GearJointDef();
            }
            else if (type === "friction") {
                joint = new Box2D.Dynamics.Joints.b2FrictionJointDef();
            }
            else if (type === "prismatic") {
                joint = new Box2D.Dynamics.Joints.b2PrismaticJointDef();
            }
            else if (type === "weld") {
                joint = new Box2D.Dynamics.Joints.b2WeldJointDef();
            }
            else if (type === "pulley") {
                joint = new Box2D.Dynamics.Joints.b2PulleyJointDef();
            }
            else if (type === "mouse") {
                joint = new Box2D.Dynamics.Joints.b2MouseJointDef();
            }
            else if (type === "line") {
                joint = new Box2D.Dynamics.Joints.b2LineJointDef();
            }
            
            if (options.enableMotor) {
                joint.enableMotor = true;
            }
            
            if (joint.Initialize) {
                joint.Initialize(e1._body,
                                 e2._body,
                                 e1._body.GetWorldCenter(),
                                 e2._body.GetWorldCenter());
            }
            this._world.CreateJoint(joint);
        },

        /**
         * @module world
         * @param x1 upper left of query box
         * @param y1 upper left of query box
         * @param x2 lower right of query box
         * @param y2 lower right of query box
         * @return a single Entity or undefined
         * @description find an entity in a given query box
         */
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

        /**
         * @module world
         * @param x1 upper left of query box
         * @param y1 upper left of query box
         * @param x2 lower right of query box
         * @param y2 lower right of query box
         * @return array of Entities. may be empty
         * @description find entities in a given query box
         */
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
        },
        
        /**
         * @module world
         * @param x new camera position (optional)
         * @param y new camera position (optional)
         * @return current camera position {x,y}
         * @description get or set position of camera
         */
        camera: function(x, y) {
            if (x === undefined && y === undefined) {
                return {x:this._cameraX, y: this._cameraY}
            }
            if (x !== undefined) {
                this._cameraX = x;
            }
            if (y !== undefined) {
                this._cameraY = y;
            }
        },
        
        /**
         * @module world
         * @param callback
         * @set the world's onRender callback. The callback gets the World
         * as an argument.
         */
        onRender: function(f) {
            this._onRender = f;
        },
        
        scale: function(s) {
            if (s !== undefined) {
                this._scale = s;
                // TODO update debug draw?
            }
            return this._scale;
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
            var cameraOffsetX = -this._world._cameraX;
            var cameraOffsetY = -this._world._cameraY;
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
                    width = height = this._ops.radius * 2;
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

                var tx = (cameraOffsetX + x + width / 4) * scale;
                var ty = (cameraOffsetY + y + height / 4) * scale;
                
                ctx.translate(tx, ty);
                
                ctx.rotate(this._body.GetAngle());
                
                ctx.drawImage(this._sprite,
                              -(width / 2 * scale),
                              -(height / 2 * scale),
                              width * scale,
                              height * scale);
                              
                ctx.rotate(0 - this._body.GetAngle());              
                              
                ctx.translate(-tx, -ty);

            }
            else if (this._ops.shape === 'polygon' || this._ops.shape === 'square') {
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
                ctx.moveTo((cameraOffsetX + vertices[0].x) * scale, (cameraOffsetY + vertices[0].y) * scale);
                for (i = 1; i < vertices.length; i++) {
                    ctx.lineTo((cameraOffsetX + vertices[i].x) * scale, (cameraOffsetY + vertices[i].y) * scale);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
            else if (this._ops.shape === 'circle') {
                var p = this.position();
                ctx.beginPath();
                ctx.arc((cameraOffsetX + p.x) * scale,
                        (cameraOffsetY + p.y) * scale,
                        this._ops.radius * scale,
                        0,
                        Math.PI * 2, true);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
        }
    };
    
    /**
     * @header
     * @description a single physical object in the physics simulation
     */
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
        
        /**
         * @module entity
         * @param {x,y} (optional)
         * @return {x,y}
         * @description get or set entity position
         */
        position: function(value) {
            if (value !== undefined) {
                this._body.SetPosition(new b2Vec2(value.x, value.y));
            }
            var p = this._body.GetPosition();
            return {x: p.x, y: p.y};
        },
        
        canvasPosition: function(value) {
            if (value !== undefined) {
                // TODO set
            }
            
            var p = this.position();
            var c = this._world.camera();
            var s = this._world.scale();
            
            return {
                x: Math.round((p.x + -c.x) * s),
                y: Math.round((p.y + -c.y) * s)
            }
        },
        
        /**
         * @module entity
         * @param degrees (optional)
         * @return degrees
         * @description get or set entity rotation
         */
        rotation: function(value) {
            if (value !== undefined) {
                this._body.SetAngle(value);
            }
            return this._body.GetAngle();
        },
        
        /**
         * @module entity
         * @param number (optional)
         * @return number
         * @description get or set entity function
         */
        friction: function(value) {
            if (value !== undefined) {
                this._body.GetFixtureList().SetFriction(value);
            }
            return this._body.GetFixtureList().GetFriction();
        },
        
        /**
         * @module entity
         * @description destroy this entity and remove it from the world
         */
        destroy: function() {
            this._destroyed = true;
            this._world._destroy(this);
        },

        /**
         * @module entity
         * @param power of impulse
         * @param angle in degrees OR x of vector
         * @param y of vector
         * @description Apply an instantanious force on this Entity
         */
        applyImpulse: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._applyImpulse(this._id, this._body, v.x, v.y);
        },
        
        /**
         * @module entity
         * @param name of force
         * @param power of force
         * @param angle in degrees OR x of vector
         * @param y of vector
         * @description Apply a constant force on this Entity. Can be removed later
         * using clearForce.
         */
        setForce: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantForce(name, this._id, this._body, v.x, v.y);
        },
        
        /**
         * @module entity
         * @param name of velocity
         * @param power of force
         * @param angle in degrees OR x of vector
         * @param y of vector
         * @description Continuously override velocity of this Entity. Can be removed later
         * using clearVelocity.
         */
        setVelocity: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantVelocity(name, this._id, this._body, v.x, v.y);
        },

        /**
         * @module entity
         * @param name of force
         * @description Stop the force with the given name.
         */
        clearForce: function(name) {
            this._world._clearConstantForce(name, this._id);
        },

        /**
         * @module entity
         * @param name of velocity
         * @description Stop the constant velocity with the given name.
         */
        clearVelocity: function(name) {
            this._world._clearConstantVelocity(name, this._id);
        },
        
        /**
         * @module entity
         * @param callback
         * @description Handle keydown event for this entity. Callback parameter
         * is the keydown event. "this" is bound to this Entity.
         */
        onKeydown: function(f) {
            this._world._addKeydownHandler(this._id, f);
        },
        
        /**
         * @module entity
         * @param callback
         * @description Handle keyup event for this entity. Callback parameter
         * is the keydown event. "this" is bound to this Entity.
         */
        onKeyup: function(f) {
            this._world._addKeyupHandler(this._id, f);
        },

        /**
         * @module entity
         * @param callback
         * @description Handle start of contact with another entity. Callback parameter
         * is the Entity contact has started with. "this" is bound to this Entity.
         */
        onStartContact: function(f) {
            this._world._addStartContactHandler(this._id, f);
        },

        /**
         * @module entity
         * @param callback
         * @description Handle end of contact with another entity. Callback parameter
         * is the Entity contact has ended with. "this" is bound to this Entity.
         */
        onFinishContact: function(f) {
            this._world._addFinishContactHandler(this._id, f);
        },

        /**
         * @module entity
         * @param callback
         * @description Handle impact with another entity.
         * @callbackParam the Entity collided with
         * @callbackParam the normal force of the impact
         * @callbackParam the tangential force of the impact
         * @callbackThis this Entity
         */
        onImpact: function(f) {
            this._world._addImpactHandler(this._id, f);
        }
        
    }
    
    return this;

})();
