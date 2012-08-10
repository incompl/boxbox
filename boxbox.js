/*
Copyright (C) 2012 Greg Smith <gsmith@incompl.com>

Released under the MIT license:
https://github.com/incompl/boxbox/blob/master/LICENSE

Created at Bocoup http://bocoup.com
*/

/**
 * @_page_title boxbox
 * @_page_css updoc-custom.css
 * @_page_description api documentation
 * @_page_home_path .
 * @_page_compact_index
 */

// Erik Moller's requestAnimationFrame shim
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelRequestAnimationFrame = window[vendors[x]+
          'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
      };
    }
}());

(function() {

    var DEGREES_PER_RADIAN = 57.2957795; // 180 / pi

    /**
     * @description global boxbox object
     */
    window.boxbox = {};
    
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
    var shapes = Box2D.Collision.Shapes;
    var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
    var b2AABB = Box2D.Collision.b2AABB;
    
    /**
     * @_module boxbox
     * @_params canvas, [options]
     * @canvas element to render on
     * @options
     * <ul>
     * @gravity (default {x:0, y:10}) can be horizontal, negative, etc
     * @allowSleep (default true) bodies may sleep when they come to
     *     rest. a sleeping body is no longer being simulated, which can
     *     improve performance.
     * @scale (default 30) scale for rendering in pixels / meter
     * @tickFrequency (default 50) onTick events happen every tickFrequency milliseconds
     * @collisionOutlines (default false) render outlines over everything for debugging collisions
     * </ul>
     * @return a new <a href="#name-World">World</a>
     * @description
     without options
     <code>var canvasElem = document.getElementById("myCanvas");
     var world = boxbox.createWorld(canvasElem);</code>
     with options
     <code>var canvasElem = document.getElementById("myCanvas");
     var world = boxbox.createWorld(canvasElem, {
     &nbsp;&nbsp;gravity: {x: 0, y: 20},
     &nbsp;&nbsp;scale: 60
     });</code>
     */
    window.boxbox.createWorld = function(canvas, options) {
        var world = create(World);
        world._init(canvas, options);
        return world;
    };
    
    var WORLD_DEFAULT_OPTIONS = {
        gravity: {x:0, y:10},
        allowSleep: true,
        scale: 30,
        tickFrequency: 50,
        collisionOutlines: false
    };
    
    var JOINT_DEFAULT_OPTIONS = {
        type: "distance",
        allowCollisions: false
    };

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
        _onRender: [],
        _onTick: [],
        _creationQueue: [],
        _positionQueue: [],
        
        _init: function(canvasElem, options) {
            var self = this;
            var key;
            var i;
            var world;
            var listener;
            this._ops = extend(options, WORLD_DEFAULT_OPTIONS);
            this._world = new b2World(new b2Vec2(this._ops.gravity.x,
                                                 this._ops.gravity.y),
                                                 true);
            world = this._world;
            this._canvas = canvasElem;
            this._ctx = this._canvas.getContext("2d");
            this._scale = this._ops.scale;
            
            // Set up rendering on the provided canvas
            if (this._canvas !== undefined) {
                
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

                // game loop (onTick events)
                window.setInterval(function() {
                    var i;
                    var ctx;
                    for (i = 0; i < self._onTick.length; i++) {
                        ctx = self._onTick[i].ctx;
                        if (!ctx._destroyed) {
                            self._onTick[i].fun.call(ctx);
                        }
                    }
                }, this._ops.tickFrequency);
                
                // animation loop
                (function animationLoop(){

                    var key;
                    var entity;
                    var v;
                    var impulse;
                    var f;
                    var toDestroy;
                    var id;
                    var o;

                    // set velocities for this step
                    for (key in self._constantVelocities) {
                        v = self._constantVelocities[key];
                        v.body.SetLinearVelocity(new b2Vec2(v.x, v.y),
                                                 v.body.GetWorldCenter());
                    }

                    // apply impulses for this step
                    for (i = 0; i < self._impulseQueue.length; i++) {
                        impulse = self._impulseQueue.pop();
                        impulse.body.ApplyImpulse(new b2Vec2(impulse.x, impulse.y),
                                                  impulse.body.GetWorldCenter());
                    }               
                    
                    // set forces for this step
                    for (key in self._constantForces) {
                        f = self._constantForces[key];
                        f.body.ApplyForce(new b2Vec2(f.x, f.y),
                                          f.body.GetWorldCenter());
                    }

                    for (key in self._entities) {
                        entity = self._entities[key];
                        v = entity._body.GetLinearVelocity();
                        if (v.x > entity._ops.maxVelocityX) {
                            v.x = entity._ops.maxVelocityX;
                        }
                        if (v.x < -entity._ops.maxVelocityX) {
                            v.x = -entity._ops.maxVelocityX;
                        }
                        if (v.y > entity._ops.maxVelocityY) {
                            v.y = entity._ops.maxVelocityY;
                        }
                        if (v.y < -entity._ops.maxVelocityY) {
                            v.y = -entity._ops.maxVelocityY;
                        }
                    }
                    
                    // destroy
                    for (i = 0; i < self._destroyQueue.length; i++) {
                        toDestroy = self._destroyQueue.pop();
                        id = toDestroy._id;
                        world.DestroyBody(toDestroy._body);
                        toDestroy._destroyed = true;
                        delete self._keydownHandlers[id];
                        delete self._startContactHandlers[id];
                        delete self._finishContactHandlers[id];
                        delete self._impactHandlers[id];
                        self._destroyQueue.splice(id, 1);
                        self._impulseQueue.splice(id, 1);
                        delete self._constantVelocities[id];
                        delete self._constantForces[id];
                        delete self._entities[id];
                    }

                    // framerate, velocity iterations, position iterations
                    world.Step(1 / 60, 10, 10);

                    // create
                    for (i = 0; i < self._creationQueue.length; i++) {
                        self.createEntity(self._creationQueue.pop());
                    }

                    // position
                    for (i = 0; i < self._positionQueue.length; i++) {
                        o = self._positionQueue.pop();
                        o.o.position.call(o.o, o.val);
                    }
                    
                    // render stuff
                    self._canvas.width = self._canvas.width;
                    for (key in self._entities) {
                      entity = self._entities[key];
                      entity._draw(self._ctx,
                                   entity.canvasPosition().x,
                                   entity.canvasPosition().y);
                    }
                    for (i = 0; i < self._onRender.length; i++) {
                      self._onRender[i].fun.call(self._onRender[i].ctx, self._ctx);
                    }
                    
                    world.ClearForces();
                    world.DrawDebugData();

                    window.requestAnimationFrame(animationLoop);
                }());
                
                // keyboard events
                window.addEventListener('keydown', function(e) {
                    for (var key in self._keydownHandlers) {
                        if (!self._entities[key]._destroyed) {
                            self._keydownHandlers[key].call(self._entities[key], e);
                        }
                    }
                }, false);
                window.addEventListener('keyup', function(e) {
                    for (var key in self._keyupHandlers) {
                        if (!self._entities[key]._destroyed) {
                            self._keyupHandlers[key].call(self._entities[key], e);
                        }
                    }
                }, false);

                // contact events
                listener = new Box2D.Dynamics.b2ContactListener();
                listener.BeginContact = function(contact) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    for (var key in self._startContactHandlers) {
                        if (a._id === Number(key) && !a._destroyed) {
                            self._startContactHandlers[key].call(self._entities[key], b);
                        }
                        if (b._id === Number(key) && !b._destroyed) {
                            self._startContactHandlers[key].call(self._entities[key], a);
                        }
                    }
                };
                listener.EndContact = function(contact) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    for (var key in self._finishContactHandlers) {
                        if (a._id === Number(key) && !a._destroyed) {
                            self._finishContactHandlers[key].call(self._entities[key], b);
                        }
                        if (b._id === Number(key) && !b._destroyed) {
                            self._finishContactHandlers[key].call(self._entities[key], a);
                        }
                    }
                };
                listener.PostSolve = function(contact, impulse) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    
                    for (var key in self._impactHandlers) {
                        if (a._id === Number(key) && !a._destroyed) {
                            self._impactHandlers[key].call(self._entities[key],
                                                           b,
                                                           impulse.normalImpulses[0],
                                                           impulse.tangentImpulses[0]);
                        }
                        if (b._id === Number(key) && !b._destroyed) {
                            self._impactHandlers[key].call(self._entities[key],
                                                           a,
                                                           impulse.normalImpulses[0],
                                                           impulse.tangentImpulses[0]);
                        }
                    }
                };
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
         * @_module world
         * @_params [value]
         * @value: {x,y}
         * @return: {x,y}
         * @description get or set the world's gravity
         */
        gravity: function(value) {
            if (value !== undefined) {
                this._world.SetGravity(new b2Vec2(0, value));
            }
            var v = this._world.GetGravity();
            return {x: v.x, y: v.y};
        },
        
        /**
         * @_module world
         * @_params options
         * @options
         * <ul>
         * @name of this entity
         * @x starting x coordinate for the center of the new entity
         * @y starting y coordinate for the center of the new entity
         * @type 'dynamic' or 'static'. static objects can't move
         * @shape 'square' or 'circle' or 'polygon'
         * @height for box (default 1)
         * @width for box (default 1)
         * @radius for circle (default 1)
         * @points for polygon [{x,y}, {x,y}, {x,y}] must go clockwise
         * must be convex
         * @density (default 2)
         * @friction (default 1)
         * @restitution or bounciness (default .2)
         * @active (default true) participates in collisions and dynamics
         * @rotation (default 0) initial rotation in degrees
         * @fixedRotation (default false) prevent entity from rotating
         * @bullet (default false) perform expensive continuous
         * collision detection
         * @maxVelocityX Prevent entity from moving too fast either left or right
         * @maxVelocityY Prevent entity from moving too fast either up or down
         * @image file for rendering
         * @imageOffsetX (default 0) for image
         * @imageOffsetY (default 0) for image
         * @imageStretchToFit (default false) for image
         * @spriteSheet Image is a sprite sheet (default false)
         * @spriteWidth Used with spriteSheet (default 16)
         * @spriteHeight Used with spriteSheet (default 16)
         * @spriteX Used with spriteSheet (default 0)
         * @spriteY Used with spriteSheet (default 0)
         * @color CSS color for rendering if no image is given (default 'gray')
         * @borderColor CSS color for rendering the shape's border (default 'black')
         * @borderWidth Width of the border. The border does not impact physics. (default 1)
         * @draw custom draw function, params are context, x, and y
         * @init a function that is run when the entity is created
         * @onKeyDown keydown event handler
         * @onKeyUp keyup event handler
         * @onStartContact start contact event handler
         * @onFinishContact finish contact event handler
         * @onImpact impact event handler
         * @onRender event handler on render
         * @onTick event handler on tick
         * </ul>
         * @return a new <a href="#name-Entity">Entity</a>
         * @description
         <h2>Example</h2>
         <code>var player = world.createEntity({
         &nbsp;&nbsp;name: "player",
         &nbsp;&nbsp;shape: "circle",
         &nbsp;&nbsp;radius: 2
         });</code>
         <h2>Templates</h2>
         You can pass multiple options objects. This allows for "templates"
         with reusable defaults:
         <code>var redCircleTemplate = {color: "red", shape: "circle", radius: 3};
         world.createEntity(redCircleTemplate, {x: 5, y: 5});
         world.createEntity(redCircleTemplate, {x: 10, y: 5});</code>
         The options objects on the right take precedence.
         <h2>Dollar Properties</h2>
         You can provide options that start with a $ like this:
         <code>var ball = world.createEntity({color: "red", $customValue: 15});</code>
         These are passed onto the resulting entity as they are:
         <code>ball.$customValue === 15</code>
         This allows you to provide your own custom methods and properties.
         */
        createEntity: function() {
            var o = {};
            var args = Array.prototype.slice.call(arguments);
            args.reverse();
            for (var key in args) {
                extend(o, args[key]);
            }
            if (this._world.IsLocked()) {
                this._creationQueue.push(o);
                return;
            }
            var entity = create(Entity);
            var id = this._nextEntityId++;
            entity._init(this, o, id);
            this._entities[id] = entity;
            return entity;
        },
        
        /**
         * @_module world
         * @_params entity1, entity2, [options]
         * @entity1 Entity on one side of the joint
         * @entity2 Entity on the other side of the joint
         * @options
         * <ul>
         * @enableMotor (default false)
         * @type one of
         * <ul>
         * @distance these entities will always remain the same distance apart
         * @revolute
         * @gear
         * @friction
         * @prismatic
         * @weld
         * @pulley
         * @mouse
         * @line
         * </ul>
         * </ul>
         * @description Experimental joint support.
         * See <a href="http://box2d.org/">box2d documentation</a> for more
         * info.
         */
        createJoint: function(entity1, entity2, options) {
            options = options || {};
            options = extend(options, JOINT_DEFAULT_OPTIONS);
            var type = options.type;
            
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
            
            var jointPositionOnEntity1 = entity1._body.GetWorldCenter();
            if (options.jointPositionOnEntity1) {
                jointPositionOnEntity1.x += options.jointPositionOnEntity1.x;
                jointPositionOnEntity1.y += options.jointPositionOnEntity1.y;
            }
            
            var jointPositionOnEntity2 = entity2._body.GetWorldCenter();
            if (options.jointPositionOnEntity2) {
                jointPositionOnEntity2.x += options.jointPositionOnEntity2.x;
                jointPositionOnEntity2.y += options.jointPositionOnEntity2.y;
            }
            
            if (type === "mouse") {
                joint.bodyA = entity1._body;
                joint.bodyB = entity2._body;
            }
            else if (joint.Initialize) {
                joint.Initialize(entity1._body,
                                 entity2._body,
                                 jointPositionOnEntity1,
                                 jointPositionOnEntity2);
            }
            if (options.allowCollisions) {
                joint.collideConnected = true;
            }
            this._world.CreateJoint(joint);
        },

        /**
         * @_module world
         * @x1 upper left of query box
         * @y1 upper left of query box
         * @x2 lower right of query box
         * @y2 lower right of query box
         * @return array of Entities. may be empty
         * @description find Entities in a given query box
         */
        find: function(x1, y1, x2, y2) {
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
         * @_module world
         * @_params [value]
         * @value {x,y}
         * @return {x,y}
         * @description get or set position of camera
         */
        camera: function(v) {
            v = v || {};
            if (v.x === undefined && v.y === undefined) {
                return {x:this._cameraX, y: this._cameraY};
            }
            if (v.x !== undefined) {
                this._cameraX = v.x;
            }
            if (v.y !== undefined) {
                this._cameraY = v.y;
            }
        },
        
        /**
         * @_module world
         * @callback function( context )
         * <ul>
         * @context canvas context for rendering
         * @this World
         * </ul>
         * @description Add an onRender callback to the World
         * This is useful for custom rendering. For example, to draw text
         * on every frame:
         * <code>world.onRender(function(ctx) {
         * &nbsp;&nbsp;ctx.fillText("Score: " + score, 10, 10);
         * });</code>
         * This callback occurs after all entities have been rendered on the
         * frame.
         * <br>
         * Multiple onRender callbacks can be added, and they can be removed
         * with unbindOnRender.
         */
        onRender: function(callback) {
            this._onRender.push({
                fun: callback,
                ctx: this
            });
        },
        
        /**
         * @_module world
         * @callback callback
         * @description
         * If the provided function is currently an onRender callback for this
         * World, it is removed.
         */
        unbindOnRender: function(callback) {
            var newArray = [];
            var i;
            for (i = 0; i < this._onRender.length; i++) {
              if (this._onRender[i].fun !== callback) {
                newArray.push(this._onRender[i]);
              }
            }
            this._onRender = newArray;
        },

        /**
         * @_module world
         * @callback function()
         * <ul>
         * @this World
         * </ul>
         * @description Add an onTick callback to the World
         * <br>
         * Ticks are periodic events that happen independant of rendering.
         * You can use ticks as your "game loop". The default tick frequency
         * is 50 milliseconds, and it can be set as an option when creating
         * the world.
         * <br>
         * Multiple onTick callbacks can be added, and they can be removed
         * with unbindOnTick.
         */
        onTick: function(callback) {
            this._onTick.push({
                fun: callback,
                ctx: this
            });
        },

        /**
         * @_module world
         * @callback callback
         * @description
         * If the provided function is currently an onTick callback for this
         * World, it is removed.
         */
        unbindOnTick: function(callback) {
            var newArray = [];
            var i;
            for (i = 0; i < this._onTick.length; i++) {
              if (this._onTick[i].fun !== callback) {
                newArray.push(this._onTick[i]);
              }
            }
            this._onTick = newArray;
        },
        
        /**
         * @_module world
         * @_params [value]
         * @value number
         * @return number
         * @description get or set the scale for rendering in pixels / meter
         */
        scale: function(s) {
            if (s !== undefined) {
                this._scale = s;
                // TODO update debug draw?
            }
            return this._scale;
        },

        /**
         * @_module world
         * @return {x,y}
         * @description Get a canvas position for a corresponding world position. Useful
         * for custom rendering in onRender. Respects world scale and camera position.
         */
        canvasPositionAt: function(x, y) {
            var c = this.camera();
            var s = this.scale();
            
            return {
                x: Math.round((x + -c.x) * s),
                y: Math.round((y + -c.y) * s)
            };
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
        restitution: 0.2, // bounciness
        active: true, // participates in collision and dynamics
        rotation: null,
        fixedRotation: false,
        bullet: false, // perform expensive continuous collision detection
        maxVelocityX: 1000,
        maxVelocityY: 1000,
        image: null,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageStretchToFit: null,
        color: 'gray',
        borderColor: 'black',
        borderWidth: 1,
        spriteSheet: false,
        spriteWidth: 16,
        spriteHeight: 16,
        spriteX: 0,
        spriteY: 0,
        init: null,
        draw: function(ctx, x, y) {
            var cameraOffsetX = -this._world._cameraX;
            var cameraOffsetY = -this._world._cameraY;
            ctx.fillStyle = this._ops.color;
            ctx.strokeStyle = this._ops.borderColor;
            ctx.lineWidth = this._ops.borderWidth;
            var i;
            var scale = this._world._scale;
            var collisionOutlines = this._world._ops.collisionOutlines;
            var ox = this._ops.imageOffsetX || 0;
            var oy = this._ops.imageOffsetY || 0;
            ox *= scale;
            oy *= scale;
            if (this._sprite !== undefined) {
                var width;
                var height;
                if (this._ops.shape === "circle" && this._ops.imageStretchToFit) {
                    width = height = this._ops.radius * 2;
                    x -= this._ops.radius / 2 * scale;
                    y -= this._ops.radius / 2 * scale;
                }
                else if (this._ops.imageStretchToFit) {
                    width = this._ops.width;
                    height = this._ops.height;
                }
                else if (this._ops.spriteSheet) {
                    width = this._ops.spriteWidth / 30;
                    height = this._ops.spriteHeight / 30;
                }
                else {
                    width = this._sprite.width / 30;
                    height = this._sprite.height / 30;
                }

                var tx = ox + (x + width / 4 * scale);
                var ty = oy + (y + height / 4 * scale);
                
                ctx.translate(tx, ty);
                
                ctx.rotate(this._body.GetAngle());
                
                if (this._ops.spriteSheet) {
                    ctx.drawImage(this._sprite,
                                  this._ops.spriteX * this._ops.spriteWidth,
                                  this._ops.spriteY * this._ops.spriteHeight,
                                  this._ops.spriteWidth,
                                  this._ops.spriteHeight,
                                  -(width / 2 * scale),
                                  -(height / 2 * scale),
                                  width * scale,
                                  height * scale);
                }
                else {
                    ctx.drawImage(this._sprite,
                                  -(width / 2 * scale),
                                  -(height / 2 * scale),
                                  width * scale,
                                  height * scale);
                }
                              
                ctx.rotate(0 - this._body.GetAngle());              
                              
                ctx.translate(-tx, -ty);

            }

            if (this._sprite && !collisionOutlines) {
                return;
            }

            if (collisionOutlines) {
                if (this._sprite !== undefined) {
                    ctx.fillStyle = "transparent";
                }
                ctx.strokeStyle = "rgb(255, 0, 255)";
                ctx.lineWidth = 2;
            }

            if (this._ops.shape === 'polygon' || this._ops.shape === 'square') {
                var poly = this._body.GetFixtureList().GetShape();
                var vertexCount = parseInt(poly.GetVertexCount(), 10);
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
                if (this._ops.borderWidth !== 0 || collisionOutlines) {
                    ctx.stroke();
                }
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
                if (this._ops.borderWidth !== 0 || collisionOutlines) {
                    ctx.stroke();
                }
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
            var ops;
            var op;

            if (options && options.components !== undefined) {
                options.components.reverse();
                options.components.forEach(function(component) {
                    extend(options, component);
                });
            }

            this._ops = extend(options, ENTITY_DEFAULT_OPTIONS);
            ops = this._ops;
            
            this._body = new b2BodyDef();
            var body = this._body;
            
            this._world = world;
            this._id = id;

            // $ props
            for (op in this._ops) {
                if (op.match(/^\$/)) {
                    this[op] = this._ops[op];
                }
            }
            
            var fixture = new b2FixtureDef();
            fixture.density = ops.density;
            fixture.friction = ops.friction;
            fixture.restitution = ops.restitution;
            
            body.position.x = ops.x;
            body.position.y = ops.y;
            
            this._name = ops.name;

            // type
            if (ops.type === 'static') {
                body.type = b2Body.b2_staticBody;
            }
            else if (ops.type === 'dynamic') {
                body.type = b2Body.b2_dynamicBody;
            }
            
            // shape
            if (ops.shape === 'square') {
                fixture.shape = new shapes.b2PolygonShape();
                // box2d asks for "half the width", we ask for the actual width
                fixture.shape.SetAsBox(ops.width / 2, ops.height / 2);
            }
            else if (ops.shape === 'circle') {
                fixture.shape = new shapes.b2CircleShape(ops.radius);
            }
            else if (ops.shape === 'polygon') {
                fixture.shape = new shapes.b2PolygonShape();
                fixture.shape.SetAsArray(ops.points, ops.points.length);
            }
            
            // rotation
            if (ops.rotation) {
                body.angle = ops.rotation / DEGREES_PER_RADIAN;
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
            if (ops.onKeyDown) {
                this._world._addKeydownHandler(id, ops.onKeyDown);
            }
            if (ops.onKeyUp) {
                this._world._addKeyupHandler(id, ops.onKeyUp);
            }
            if (ops.onRender) {
                this.onRender(ops.onRender);
            }
            if (ops.onTick) {
                this.onTick(ops.onTick);
            }

            // custom init function
            if (ops.init) {
                ops.init.call(this);
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
                x = a * power;
                y = b * power;
            }
            return {x:x,y:y};
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @return entity name
         * @description get or set entity name
         */
        name: function(value) {
          if (value !== undefined) {
            this._name = value;
          }
          return this._name;
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @value {x,y}
         * @return {x,y}
         * @description get or set entity position
         */
        position: function(value) {
            if (value !== undefined) {
                if (this._world._world.IsLocked()) {
                    this._world._positionQueue.push({
                        o: this,
                        val: value
                    });
                }
                else {
                    this._body.SetPosition(new b2Vec2(value.x, value.y));
                }
            }
            var p = this._body.GetPosition();
            return {x: p.x, y: p.y};
        },
        
        /**
         * @_module entity
         * @_params
         * @return {x,y}
         * @description Get the Entity position in pixels. Useful for custom
         * rendering. Unlike <a href="#name-position">position</a> the result
         * is relative to the World's scale and camera position.
         */
        canvasPosition: function(value) {
            if (value !== undefined) {
                // TODO set
            }
            
            var p = this.position();

            return this._world.canvasPositionAt(p.x, p.y);
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @value degrees
         * @return degrees
         * @description get or set entity rotation
         */
        rotation: function(value) {
            if (value !== undefined) {
                this._body.SetAngle(value / DEGREES_PER_RADIAN);
            }
            return this._body.GetAngle() * DEGREES_PER_RADIAN;
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity friction
         */
        friction: function(value) {
            if (value !== undefined) {
                this._body.GetFixtureList().SetFriction(value);
            }
            return this._body.GetFixtureList().GetFriction();
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity restitution (bounciness)
         */
        restitution: function(value) {
            if (value !== undefined) {
                this._body.GetFixtureList().SetRestitution(value);
            }
            return this._body.GetFixtureList().GetRestitution();
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity max velocity left or right
         */
        maxVelocityX: function(value) {
            if (value !== undefined) {
                this._ops.maxVelocityX = value;
            }
            return this._ops.maxVelocityX;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity max velocity up or down
         */
        maxVelocityY: function(value) {
            if (value !== undefined) {
                this._ops.maxVelocityY = value;
            }
            return this._ops.maxVelocityY;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value string
         * @return string
         * @description get or set entity image
         */
        image: function(value) {
            if (value !== undefined) {
                this._sprite = new Image();
                this._sprite.src = value;
            }
            return this._sprite.src;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity image offset in the x direction
         */
        imageOffsetX: function(value) {
            if (value !== undefined) {
                this._ops.imageOffsetX = value;
            }
            return this._ops.imageOffsetX;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity image offset in the y direction
         */
        imageOffsetY: function(value) {
            if (value !== undefined) {
                this._ops.imageOffsetY = value;
            }
            return this._ops.imageOffsetY;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value boolean
         * @return boolean
         * @description set to true to stretch image to entity size
         */
        imageStretchToFit: function(value) {
            if (value !== undefined) {
                this._ops.imageStretchToFit = value;
            }
            return this._ops.imageStretchToFit;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value css color string
         * @return css color string
         * @description get or set entity's color
         */
        color: function(value) {
            if (value !== undefined) {
                this._ops.color = value;
            }
            return this._ops.color;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value css color string
         * @return css color string
         * @description get or set entity's border color
         */
        borderColor: function(value) {
            if (value !== undefined) {
                this._ops.borderColor = value;
            }
            return this._ops.borderColor;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity's border width.
         * Set to 0 to not show a border.
         */
        borderWidth: function(value) {
            if (value !== undefined) {
                this._ops.borderWidth = value;
            }
            return this._ops.borderWidth;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value boolean
         * @return boolean
         * @description get or set if this entity's image is a sprite sheet
         */
        spriteSheet: function(value) {
            if (value !== undefined) {
                this._ops.spriteSheet = value;
            }
            return this._ops.spriteSheet;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set width of a sprite on the sprite sheet
         */
        spriteWidth: function(value) {
            if (value !== undefined) {
                this._ops.spriteWidth = value;
            }
            return this._ops.spriteWidth;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set height of a sprite on the sprite sheet
         */
        spriteHeight: function(value) {
            if (value !== undefined) {
                this._ops.spriteHeight = value;
            }
            return this._ops.spriteHeight;
        },

        /**
         * @_module entity
         * @_params [value]
         * @value function
         * @return function
         * @description get or set the draw function for this entity
         */
        draw: function(value) {
            if (value !== undefined) {
                this._draw = value;
            }
            return this._draw;
        },
        
        /**
         * @_module entity
         * @description destroy this entity and remove it from the world
         */
        destroy: function() {
            this._destroyed = true;
            this._world._destroy(this);
        },

        /**
         * @_module entity
         * @power of impulse
         * @degrees direction of force. 0 is up, 90 is right, etc.
         * @_params power, degrees
         * @description Apply an instantanious force on this Entity.
         * <br>
         * With this and all functions that take degrees, you can also provide
         * a vector.
         * <code>entity.applyImpulse(10, 45); // 45 degree angle
         * entity.applyImpulse(10, 1, -1); // the vector x=1 y=-1}</code>
         */
        applyImpulse: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._applyImpulse(this._id, this._body, v.x, v.y);
        },
        
        /**
         * @_module entity
         * @name of force
         * @power of force
         * @degrees direction of force
         * @_params name, power, degrees
         * @description Apply a constant force on this Entity. Can be removed later
         * using clearForce.
         */
        setForce: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantForce(name, this._id, this._body, v.x, v.y);
        },
        
        /**
         * @_module entity
         * @name of velocity
         * @power of velocity
         * @degrees direction of velocity
         * @_params name, power, degrees
         * @description Continuously override velocity of this Entity. Can be removed later
         * using clearVelocity. Usually you probably want setForce or applyImpulse.
         */
        setVelocity: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantVelocity(name, this._id, this._body, v.x, v.y);
        },

        /**
         * @_module entity
         * @description Stop the force with the given name.
         */
        clearForce: function(name) {
            this._world._clearConstantForce(name, this._id);
        },

        /**
         * @_module entity
         * @description Stop the constant velocity with the given name.
         */
        clearVelocity: function(name) {
            this._world._clearConstantVelocity(name, this._id);
        },
        
        /**
         * @_module entity
         * @callback function( e )
         * <ul>
         * @e keydown event
         * @this this Entity
         * </ul>
         * @description Handle keydown event for this entity.
         */
        onKeydown: function(callback) {
            this._world._addKeydownHandler(this._id, callback);
        },
        
        /**
         * @_module entity
         * @callback function( e )
         * <ul>
         * @e keyup event
         * @this this Entity
         * </ul>
         * @description Handle keyup event for this entity.
         */
        onKeyup: function(callback) {
            this._world._addKeyupHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( entity )
         * <ul>
         * @entity that contact started with
         * @this this Entity
         * </ul>
         * @description Handle start of contact with another entity.
         */
        onStartContact: function(callback) {
            this._world._addStartContactHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( entity )
         * <ul>
         * @entity that contact ended with
         * @this this Entity
         * </ul>
         * @description Handle end of contact with another entity.
         */
        onFinishContact: function(callback) {
            this._world._addFinishContactHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( entity, normalForce, tangentialForce )
         * <ul>
         * @entity collided with
         * @normalForce force of two entities colliding
         * @tangentialForce force of two entities "rubbing" up against each other
         * @this this Entity
         * </ul>
         * @description Handle impact with another entity.
         */
        onImpact: function(callback) {
            this._world._addImpactHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( context )
         * <ul>
         * @context canvas context for rendering
         * @this Entity
         * </ul>
         * @description Add an onRender callback to this Entity
         * <br>
         * Multiple onRender callbacks can be added, and they can be removed
         * with world.unbindOnRender.
         */
        onRender: function(callback) {
            this._world._onRender.push({
                fun: callback,
                ctx: this
            });
        },

        /**
         * @_module entity
         * @callback function()
         * <ul>
         * @this Entity
         * </ul>
         * @description Add an onTick callback to this Entity
         * <br>
         * Ticks are periodic events that happen independant of rendering.
         * You can use ticks as your "game loop". The default tick frequency
         * is 50 milliseconds, and it can be set as an option when creating
         * the world.
         * <br>
         * Multiple onTick callbacks can be added, and they can be removed
         * with world.unbindOnTick.
         */
        onTick: function(callback) {
            this._world._onTick.push({
                fun: callback,
                ctx: this
            });
        },

        /**
         * @_module entity
         * @description Set the entity's image to the sprite at x, y on the sprite sheet.
         * Used only on entities with spriteSheet:true
         */
        sprite: function(x, y) {
            this._ops.spriteX = x;
            this._ops.spriteY = y;
        }
        
    };

}());
