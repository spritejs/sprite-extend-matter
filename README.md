# sprite-extend-matter

This is a spritejs extension based on [matter-js](https://github.com/liabru/matter-js/).

```html
<script src="https://s4.ssl.qhres.com/!012baa06/sprite-extend-matter.js"></script>
```

## Quick Start

```html
<div id="container"></div>
<script src="https://s4.ssl.qhres.com/!012baa06/sprite-extend-matter.js"></script>
<script src="https://s4.ssl.qhres.com/!012baa06/sprite-extend-matter.js"></script>
<script>
  const Matter = spritejs.Matter;
  const {Scene, Path} = spritejs;

  const scene = new Scene('#container', {resolution: [800, 600]})
  const fglayer = scene.layer('fglayer')

  var Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Composites = Matter.Composites,
      Common = Matter.Common,
      MouseConstraint = Matter.MouseConstraint,
      Mouse = Matter.Mouse,
      World = Matter.World,
      Bodies = Matter.Bodies;

  // create engine
  var engine = Engine.create({enableSleeping: true}),
      world = engine.world;

  // create renderer
  var render = Render.create({
      layer: fglayer,
      engine: engine,
      options: {
          showAngleIndicator: true,
          background: '#fff',
          wireframes: false,
          showBroadphase: false,
          showBounds: true,
          showVelocity: true, 
          showSeparations: true,
      }
  });

  Render.run(render);

  // create runner
  var runner = Runner.create();
  Runner.run(runner, engine);

  // add bodies
  var stack = Composites.stack(20, 20, 10, 5, 0, 0, function(x, y) {
      var sides = Math.round(Common.random(1, 8));

      // triangles can be a little unstable, so avoid until fixed
      sides = (sides === 3) ? 4 : sides;

      // round the edges of some bodies
      var chamfer = null;
      if (sides > 2 && Common.random() > 0.7) {
          chamfer = {
              radius: 10
          };
      }
      
      switch (Math.round(Common.random(0, 1))) {
      case 0:
          if (Common.random() < 0.6) {
              return Bodies.rectangle(x, y, Common.random(25, 50), Common.random(25, 50), { chamfer: chamfer });
          } else if(Common.random() < 0.8) {
              return Bodies.rectangle(x, y, Common.random(80, 120), Common.random(25, 30), { chamfer: chamfer });
          } else {
              const width = 64
              return Bodies.rectangle(x, y, width, width, { chamfer: chamfer, 
                  render: {
                      sprite: {
                          // texture: 'https://p5.ssl.qhimg.com/t01bd0523f7bc9241c2.png',
                          attrs: {
                              textures: {
                                  // src: 'http://brm.io/matter-js/demo/img/box.png',
                                  src: 'https://p5.ssl.qhimg.com/t01bd0523f7bc9241c2.png',
                                  srcRect: [32, 32, 64, 64],
                              },
                              size: [width, width],
                          }
                      }
                  } 
              });
          }
      case 1:
          return Bodies.polygon(x, y, sides, Common.random(25, 50), { chamfer: chamfer });
      }
  });

  World.add(world, stack);

  World.add(world, [
      // walls
      Bodies.rectangle(400, 0, 800, 50, { isStatic: true }),
      Bodies.rectangle(400, 600, 800, 50, { isStatic: true }),
      Bodies.rectangle(800, 300, 50, 600, { isStatic: true }),
      Bodies.rectangle(0, 300, 50, 600, { isStatic: true })
  ]);

  // add mouse control
  var mouse = Mouse.create(render.canvas),
      mouseConstraint = MouseConstraint.create(engine, {
          mouse: mouse,
          constraint: {
              stiffness: 0.2,
              render: {
                  visible: false
              }
          }
      });

  World.add(world, mouseConstraint);

  // keep the mouse in sync with rendering
  render.mouse = mouse;

  // fit the render viewport to the scene
  // Render.lookAt(render, {
  //     min: { x: 0, y: 0 },
  //     max: { x: 800, y: 600 }
  // });
</script>
```
