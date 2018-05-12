/**
* The `Matter.Render` module is a spritejs based renderer for visualising instances of `Matter.Engine`.
* It is intended for development and debugging purposes, but may also be suitable for simple games.
* It includes a number of drawing options including wireframe, vector with support for sprites and viewports.
*
* @class Render
*/
import {Sprite, Path} from 'sprite-core'

const Render = {}

export default Render

const Matter = require('matter-js')
const {Common, Composite, Bounds, Events, Grid, Vector, Mouse} = Matter

let _requestAnimationFrame,
  _cancelAnimationFrame

if(typeof window !== 'undefined') {
  _requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
                  || window.mozRequestAnimationFrame || window.msRequestAnimationFrame
                  || function (callback) { window.setTimeout(() => callback(Common.now()), 1000 / 60) }

  _cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame
                  || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame
}

/**
 * Creates a new renderer. The options parameter is an object that specifies any properties you wish to override the defaults.
 * All properties have default values, and many are pre-calculated automatically based on other properties.
 * See the properties section below for detailed information on what you can pass via the `options` object.
 * @method create
 * @param {object} [options]
 * @return {render} A new renderer
 */
Render.create = function (options) {
  const defaults = {
    controller: Render,
    engine: null,
    layer: null,
    mouse: null,
    frameRequestId: null,
    options: {
      background: '#18181d',
      wireframeBackground: '#0f0f13',
      hasBounds: !!options.bounds,
      enabled: true,
      wireframes: true,
      showSleeping: true,
      showDebug: false,
      showBroadphase: false,
      showBounds: false,
      showVelocity: false,
      showCollisions: false,
      showSeparations: false,
      showAxes: false,
      showPositions: false,
      showAngleIndicator: false,
      showIds: false,
      showShadows: false,
      showVertexNumbers: false,
      showConvexHulls: false,
      showInternalEdges: false,
      showMousePosition: false,
    },
  }

  const render = Common.extend(defaults, options)

  render.mouse = options.mouse
  render.engine = options.engine
  render.canvas = options.layer.canvas
  render.context = render.canvas.getContext('2d')
  render.textures = {}

  render.bounds = render.bounds || {
    min: {
      x: 0,
      y: 0,
    },
    max: {
      x: render.canvas.width,
      y: render.canvas.height,
    },
  }
  return render
}

/**
 * Continuously updates the render canvas on the `requestAnimationFrame` event.
 * @method run
 * @param {render} render
 */
Render.run = function (render) {
  (function loop(time) {
    render.frameRequestId = _requestAnimationFrame(loop)
    Render.world(render)
  }())
}

/**
 * Ends execution of `Render.run` on the given `render`, by canceling the animation frame request event loop.
 * @method stop
 * @param {render} render
 */
Render.stop = function (render) {
  if(render.extraDraw) {
    render.layer.off(render.extraDraw)
    delete render.extraDraw
  }
  _cancelAnimationFrame(render.frameRequestId)
}

/**
 * Positions and sizes the viewport around the given object bounds.
 * Objects must have at least one of the following properties:
 * - `object.bounds`
 * - `object.position`
 * - `object.min` and `object.max`
 * - `object.x` and `object.y`
 * @method lookAt
 * @param {render} render
 * @param {object[]} objects
 * @param {vector} [padding]
 * @param {bool} [center=true]
 */
Render.lookAt = function (render, objects, padding, center) {
  center = typeof center !== 'undefined' ? center : true
  objects = Common.isArray(objects) ? objects : [objects]
  padding = padding || {
    x: 0,
    y: 0,
  }

  // find bounds of all objects
  const bounds = {
    min: {x: Infinity, y: Infinity},
    max: {x: -Infinity, y: -Infinity},
  }
  for(let i = 0; i < objects.length; i += 1) {
    const object = objects[i],
      min = object.bounds ? object.bounds.min : (object.min || object.position || object),
      max = object.bounds ? object.bounds.max : (object.max || object.position || object)

    if(min && max) {
      if(min.x < bounds.min.x) { bounds.min.x = min.x }

      if(max.x > bounds.max.x) { bounds.max.x = max.x }

      if(min.y < bounds.min.y) { bounds.min.y = min.y }

      if(max.y > bounds.max.y) { bounds.max.y = max.y }
    }
  }

  // find ratios
  const width = (bounds.max.x - bounds.min.x) + 2 * padding.x,
    height = (bounds.max.y - bounds.min.y) + 2 * padding.y,
    viewHeight = render.canvas.height,
    viewWidth = render.canvas.width,
    outerRatio = viewWidth / viewHeight,
    innerRatio = width / height
  let scaleX = 1,
    scaleY = 1

    // find scale factor
  if(innerRatio > outerRatio) {
    scaleY = innerRatio / outerRatio
  } else {
    scaleX = outerRatio / innerRatio
  }

  // enable bounds
  render.options.hasBounds = true

  // position and size
  render.bounds.min.x = bounds.min.x
  render.bounds.max.x = bounds.min.x + width * scaleX
  render.bounds.min.y = bounds.min.y
  render.bounds.max.y = bounds.min.y + height * scaleY

  // center
  if(center) {
    render.bounds.min.x += width * 0.5 - (width * scaleX) * 0.5
    render.bounds.max.x += width * 0.5 - (width * scaleX) * 0.5
    render.bounds.min.y += height * 0.5 - (height * scaleY) * 0.5
    render.bounds.max.y += height * 0.5 - (height * scaleY) * 0.5
  }

  // padding
  render.bounds.min.x -= padding.x
  render.bounds.max.x -= padding.x
  render.bounds.min.y -= padding.y
  render.bounds.max.y -= padding.y

  // update mouse
  if(render.mouse) {
    Mouse.setScale(render.mouse, {
      x: (render.bounds.max.x - render.bounds.min.x) / render.canvas.width,
      y: (render.bounds.max.y - render.bounds.min.y) / render.canvas.height,
    })

    Mouse.setOffset(render.mouse, render.bounds.min)
  }
}

/**
 * Applies viewport transforms based on `render.bounds` to a render context.
 * @method startViewTransform
 * @param {render} render
 */
Render.startViewTransform = function (render) {
  const boundsWidth = render.bounds.max.x - render.bounds.min.x,
    boundsHeight = render.bounds.max.y - render.bounds.min.y,
    boundsScaleX = boundsWidth / render.options.width,
    boundsScaleY = boundsHeight / render.options.height

  render.context.scale(1 / boundsScaleX, 1 / boundsScaleY)
  render.context.translate(-render.bounds.min.x, -render.bounds.min.y)
}

/**
 * Resets all transforms on the render context.
 * @method endViewTransform
 * @param {render} render
 */
Render.endViewTransform = function (render) {
  render.context.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0)
}

/**
 * Renders the given `engine`'s `Matter.World` object.
 * This is the entry point for all rendering and should be called every time the scene changes.
 * @method world
 * @param {render} render
 */
Render.world = function (render) {
  const engine = render.engine,
    world = engine.world,
    context = render.context,
    options = render.options,
    layer = render.layer,
    allBodies = Composite.allBodies(world),
    allConstraints = Composite.allConstraints(world),
    background = options.wireframes ? options.wireframeBackground : options.background


  let bodies = [],
    constraints = []

  const event = {
    timestamp: engine.timing.timestamp,
  }

  Events.trigger(render, 'beforeRender', event)

  // apply background if it has changed
  if(render.currentBackground !== background) { _applyBackground(render, background) }

  // handle bounds
  if(options.hasBounds) {
    // filter out bodies that are not in view
    for(let i = 0; i < allBodies.length; i++) {
      const body = allBodies[i]
      if(Bounds.overlaps(body.bounds, render.bounds)) { bodies.push(body) }
    }

    // filter out constraints that are not in view
    for(let i = 0; i < allConstraints.length; i++) {
      const constraint = allConstraints[i],
        bodyA = constraint.bodyA,
        bodyB = constraint.bodyB
      let pointAWorld = constraint.pointA,
        pointBWorld = constraint.pointB

      if(bodyA) pointAWorld = Vector.add(bodyA.position, constraint.pointA)
      if(bodyB) pointBWorld = Vector.add(bodyB.position, constraint.pointB)

      if(pointAWorld && pointBWorld) {
        if(Bounds.contains(render.bounds, pointAWorld) || Bounds.contains(render.bounds, pointBWorld)) {
          constraints.push(constraint)
        }
      }
    }

    // transform the view
    Render.startViewTransform(render)

    // update mouse
    if(render.mouse) {
      Mouse.setScale(render.mouse, {
        x: (render.bounds.max.x - render.bounds.min.x) / render.canvas.width,
        y: (render.bounds.max.y - render.bounds.min.y) / render.canvas.height,
      })

      Mouse.setOffset(render.mouse, render.bounds.min)
    }
  } else {
    constraints = allConstraints
    bodies = allBodies
  }

  if(!options.wireframes) {
    // fully featured rendering of bodies
    Render.bodies(render, bodies, context)
  } else {
    if(options.showConvexHulls) { Render.bodyConvexHulls(render, bodies, context) }

    // optimised method for wireframes only
    Render.bodyWireframes(render, bodies, context)
  }

  if(!render.extraDraw) {
    const extraDraw = () => {
      if(options.showBounds) { Render.bodyBounds(render, bodies, context) }

      if(options.showAxes || options.showAngleIndicator) { Render.bodyAxes(render, bodies, context) }

      if(options.showPositions) { Render.bodyPositions(render, bodies, context) }

      if(options.showVelocity) { Render.bodyVelocity(render, bodies, context) }

      if(options.showIds) { Render.bodyIds(render, bodies, context) }

      if(options.showSeparations) { Render.separations(render, engine.pairs.list, context) }

      if(options.showCollisions) { Render.collisions(render, engine.pairs.list, context) }

      if(options.showVertexNumbers) { Render.vertexNumbers(render, bodies, context) }

      if(options.showMousePosition) { Render.mousePosition(render, render.mouse, context) }

      Render.constraints(constraints, context)

      if(options.showBroadphase && engine.broadphase.controller === Grid) { Render.grid(render, engine.broadphase, context) }

      if(options.showDebug) { Render.debug(render, context) }

      if(options.hasBounds) {
        // revert view transforms
        Render.endViewTransform(render)
      }
      layer.off('update', extraDraw)
      delete render.extraDraw

      Events.trigger(render, 'afterRender', event)
    }

    layer.on('update', extraDraw)
    render.extraDraw = extraDraw
  }
}

/**
 * Description
 * @private
 * @method debug
 * @param {render} render
 * @param {RenderingContext} context
 */
Render.debug = function (render, context) {
  const c = context,
    engine = render.engine,
    world = engine.world,
    metrics = engine.metrics,
    options = render.options,
    bodies = Composite.allBodies(world),
    space = '  '

  if(engine.timing.timestamp - (render.debugTimestamp || 0) >= 500) {
    let text = ''

    if(metrics.timing) {
      text += `fps: ${Math.round(metrics.timing.fps)}${space}`
    }

    // @if DEBUG
    if(metrics.extended) {
      if(metrics.timing) {
        text += `delta: ${metrics.timing.delta.toFixed(3)}${space}`
        text += `correction: ${metrics.timing.correction.toFixed(3)}${space}`
      }

      text += `bodies: ${bodies.length}${space}`

      if(engine.broadphase.controller === Grid) { text += `buckets: ${metrics.buckets}${space}` }

      text += '\n'

      text += `collisions: ${metrics.collisions}${space}`
      text += `pairs: ${engine.pairs.list.length}${space}`
      text += `broad: ${metrics.broadEff}${space}`
      text += `mid: ${metrics.midEff}${space}`
      text += `narrow: ${metrics.narrowEff}${space}`
    }
    // @endif

    render.debugString = text
    render.debugTimestamp = engine.timing.timestamp
  }

  if(render.debugString) {
    c.font = '12px Arial'

    if(options.wireframes) {
      c.fillStyle = 'rgba(255,255,255,0.5)'
    } else {
      c.fillStyle = 'rgba(0,0,0,0.5)'
    }

    const split = render.debugString.split('\n')

    for(let i = 0; i < split.length; i++) {
      c.fillText(split[i], 50, 50 + i * 18)
    }
  }
}

/**
 * Description
 * @private
 * @method constraints
 * @param {constraint[]} constraints
 * @param {RenderingContext} context
 */
Render.constraints = function (constraints, context) {
  const c = context

  for(let i = 0; i < constraints.length; i++) {
    const constraint = constraints[i]

    if(!constraint.render.visible || !constraint.pointA || !constraint.pointB) {
      continue
    }
    const bodyA = constraint.bodyA,
      bodyB = constraint.bodyB

    let start,
      end
    if(bodyA) {
      start = Vector.add(bodyA.position, constraint.pointA)
    } else {
      start = constraint.pointA
    }

    if(constraint.render.type === 'pin') {
      c.beginPath()
      c.arc(start.x, start.y, 3, 0, 2 * Math.PI)
      c.closePath()
    } else {
      if(bodyB) {
        end = Vector.add(bodyB.position, constraint.pointB)
      } else {
        end = constraint.pointB
      }

      c.beginPath()
      c.moveTo(start.x, start.y)

      if(constraint.render.type === 'spring') {
        const delta = Vector.sub(end, start),
          normal = Vector.perp(Vector.normalise(delta)),
          coils = Math.ceil(Common.clamp(constraint.length / 5, 12, 20))
        let offset
        for(let j = 1; j < coils; j += 1) {
          offset = j % 2 === 0 ? 1 : -1

          c.lineTo(
            start.x + delta.x * (j / coils) + normal.x * offset * 4,
            start.y + delta.y * (j / coils) + normal.y * offset * 4
          )
        }
      }

      c.lineTo(end.x, end.y)
    }

    if(constraint.render.lineWidth) {
      c.lineWidth = constraint.render.lineWidth
      c.strokeStyle = constraint.render.strokeStyle
      c.stroke()
    }

    if(constraint.render.anchors) {
      c.fillStyle = constraint.render.strokeStyle
      c.beginPath()
      c.arc(start.x, start.y, 3, 0, 2 * Math.PI)
      c.arc(end.x, end.y, 3, 0, 2 * Math.PI)
      c.closePath()
      c.fill()
    }
  }
}

/**
 * Description
 * @private
 * @method bodyShadows
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyShadows = function (render, bodies, context) {
  const c = context

  for(let i = 0; i < bodies.length; i++) {
    const body = bodies[i]

    if(!body.render.visible) {
      continue
    } if(body.circleRadius) {
      c.beginPath()
      c.arc(body.position.x, body.position.y, body.circleRadius, 0, 2 * Math.PI)
      c.closePath()
    } else {
      c.beginPath()
      c.moveTo(body.vertices[0].x, body.vertices[0].y)
      for(let j = 1; j < body.vertices.length; j++) {
        c.lineTo(body.vertices[j].x, body.vertices[j].y)
      }
      c.closePath()
    }

    const distanceX = body.position.x - render.options.width * 0.5,
      distanceY = body.position.y - render.options.height * 0.2,
      distance = Math.abs(distanceX) + Math.abs(distanceY)

    c.shadowColor = 'rgba(0,0,0,0.15)'
    c.shadowOffsetX = 0.05 * distanceX
    c.shadowOffsetY = 0.05 * distanceY
    c.shadowBlur = 1 + 12 * Math.min(1, distance / 1000)

    c.fill()

    c.shadowColor = null
    c.shadowOffsetX = null
    c.shadowOffsetY = null
    c.shadowBlur = null
  }
}

/**
 * Description
 * @private
 * @method bodies
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodies = function (render, bodies, context) {
  const layer = render.layer,
    options = render.options

  let body,
    part

  for(let i = 0; i < bodies.length; i++) {
    body = bodies[i]

    if(!body.render.visible) { continue }

    // handle compound parts
    for(let k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
      part = body.parts[k]
      const {position, angle} = part
      const pos = [
          Math.round(position.x * 10) / 10,
          Math.round(position.y * 10) / 10,
        ],
        rotate = Math.round(180 * angle * 10 / Math.PI) / 10

      if(!part.render.visible) {
        continue
      }

      let s = part.spriteNode
      if(s) {
        s.attr({
          pos,
          rotate,
        })
      } else if(part.render.sprite && (part.render.sprite.texture || part.render.sprite.attrs && part.render.sprite.attrs.textures)) {
        // part sprite

        const sprite = part.render.sprite,
          texture = sprite.texture

        s = new Sprite()
        s.attr({
          anchor: [sprite.xOffset, sprite.yOffset],
          scale: [sprite.xScale, sprite.yScale],
          pos,
          rotate,
        })
        if(texture) {
          s.attr({
            textures: [texture],
          })
        }
        part.spriteNode = s
        layer.append(s)
      } else if(part.circleRadius) {
        // part polygon
        s = new Sprite()
        s.attr({
          anchor: 0.5,
          size: [2 * part.circleRadius, 2 * part.circleRadius],
          borderRadius: part.circleRadius,
          pos,
          rotate,
          bgcolor: part.render.fillStyle,
        })
        part.spriteNode = s
        layer.append(s)
      } else {
        const {vertices} = part
        const {x: x0, y: y0} = vertices[0]

        let d = `M${x0},${y0}`
        for(let j = 1; j < vertices.length; j++) {
          const x = vertices[j].x,
            y = vertices[j].y
          d += `L${x},${y}`
        }
        d += 'z'
        s = new Path()
        s.attr({
          anchor: 0.5,
          path: {d, trim: true},
          pos,
          rotate,
          fillColor: part.render.fillStyle,
        })
        part.spriteNode = s
        layer.append(s)
      }

      if(part.render.sprite && part.render.sprite.attrs) {
        s.attr(part.render.sprite.attrs)
      }
      if(options.showSleeping && body.isSleeping) {
        if(!part.fullOpacity) {
          const opacity = s.attr('opacity')
          s.attr('opacity', 0.5 * opacity)
          part.fullOpacity = opacity
        }
      } else if(part.fullOpacity) {
        s.attr('opacity', part.fullOpacity)
        delete part.fullOpacity
      }
    }
  }
}

/**
 * Optimised method for drawing body wireframes in one pass
 * @private
 * @method bodyWireframes
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyWireframes = function (render, bodies, context) {
  const c = context,
    layer = render.layer,
    options = render.options,
    showInternalEdges = render.options.showInternalEdges

  let body,
    part

  c.beginPath()

  // render all bodies
  for(let i = 0; i < bodies.length; i++) {
    body = bodies[i]

    if(!body.render.visible) { continue }

    // handle compound parts
    for(let k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
      part = body.parts[k]
      const {position, angle} = part
      const pos = [
          Math.round(position.x * 10) / 10,
          Math.round(position.y * 10) / 10,
        ],
        rotate = Math.round(180 * angle * 10 / Math.PI) / 10

      let s = part.spriteNode
      if(s) {
        s.attr({
          pos,
          rotate,
        })
      } else {
        let {vertices} = part
        const {x: x0, y: y0} = vertices[0]

        if(!showInternalEdges) {
          vertices = vertices.filter(v => !v.isInternal)
        }

        let d = `M${x0},${y0}`
        for(let j = 1; j < vertices.length; j++) {
          const x = vertices[j].x,
            y = vertices[j].y
          d += `L${x},${y}`
        }
        d += 'z'
        s = new Path()
        s.attr({
          anchor: 0.5,
          path: {d, trim: true},
          pos,
          rotate,
          strokeColor: '#bbb',
        })
        part.spriteNode = s
        layer.append(s)
      }
      if(options.showSleeping && body.isSleeping) {
        if(!part.fullOpacity) {
          const opacity = s.attr('opacity')
          s.attr('opacity', 0.5 * opacity)
          part.fullOpacity = opacity
        }
      } else if(part.fullOpacity) {
        s.attr('opacity', part.fullOpacity)
        delete part.fullOpacity
      }
    }
  }
}

/**
 * Optimised method for drawing body convex hull wireframes in one pass
 * @private
 * @method bodyConvexHulls
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyConvexHulls = function (render, bodies, context) {
  const c = context,
    layer = render.layer

  let body

  c.beginPath()

  // render convex hulls
  for(let i = 0; i < bodies.length; i++) {
    body = bodies[i]
    const {position, angle} = body
    const pos = [
        Math.round(position.x * 10) / 10,
        Math.round(position.y * 10) / 10,
      ],
      rotate = Math.round(180 * angle * 10 / Math.PI) / 10

    if(!body.render.visible || body.parts.length === 1) {
      continue
    }
    let s = body.spriteNode
    if(s) {
      s.attr({
        pos,
        rotate,
      })
    } else {
      const {vertices} = body
      const {x: x0, y: y0} = vertices[0]
      let d = 'M0,0'
      for(let j = 1; j < vertices.length; j++) {
        const x = vertices[j].x - x0,
          y = vertices[j].y - y0
        d += `L${x},${y}`
      }
      d += 'z'
      s = new Path()
      s.attr({
        anchor: 0.5,
        path: {d, trim: true},
        pos,
        rotate,
        strokeColor: 'rgba(255,255,255,0.2)',
      })
      body.spriteNode = s
      layer.append(s)
    }
  }
}

/**
 * Renders body vertex numbers.
 * @private
 * @method vertexNumbers
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.vertexNumbers = function (render, bodies, context) {
  const c = context

  for(let i = 0; i < bodies.length; i++) {
    const parts = bodies[i].parts
    for(let k = parts.length > 1 ? 1 : 0; k < parts.length; k++) {
      const part = parts[k]
      for(let j = 0; j < part.vertices.length; j++) {
        c.fillStyle = 'rgba(255,255,255,0.2)'
        c.fillText(`${i}_${j}`, part.position.x + (part.vertices[j].x - part.position.x) * 0.8, part.position.y + (part.vertices[j].y - part.position.y) * 0.8)
      }
    }
  }
}

/**
 * Renders mouse position.
 * @private
 * @method mousePosition
 * @param {render} render
 * @param {mouse} mouse
 * @param {RenderingContext} context
 */
Render.mousePosition = function (render, mouse, context) {
  const c = context
  c.fillStyle = 'rgba(255,255,255,0.8)'
  c.fillText(`${mouse.position.x}  ${mouse.position.y}`, mouse.position.x + 5, mouse.position.y - 5)
}

/**
 * Draws body bounds
 * @private
 * @method bodyBounds
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyBounds = function (render, bodies, context) {
  const c = context,
    options = render.options

  c.beginPath()

  for(let i = 0; i < bodies.length; i++) {
    const body = bodies[i]

    if(body.render.visible) {
      const parts = bodies[i].parts
      for(let j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
        const part = parts[j]
        c.rect(part.bounds.min.x, part.bounds.min.y, part.bounds.max.x - part.bounds.min.x, part.bounds.max.y - part.bounds.min.y)
      }
    }
  }

  if(options.wireframes) {
    c.strokeStyle = 'rgba(255,255,255,0.8)'
  } else {
    c.strokeStyle = 'rgba(0,0,0,0.1)'
  }

  c.lineWidth = 1
  c.stroke()
}

/**
 * Draws body angle indicators and axes
 * @private
 * @method bodyAxes
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyAxes = function (render, bodies, context) {
  const c = context,
    options = render.options
  let part

  c.beginPath()

  for(let i = 0; i < bodies.length; i++) {
    const body = bodies[i],
      parts = body.parts

    if(!body.render.visible) {
      continue
    } if(options.showAxes) {
      // render all axes
      for(let j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
        part = parts[j]
        for(let k = 0; k < part.axes.length; k++) {
          const axis = part.axes[k]
          c.moveTo(part.position.x, part.position.y)
          c.lineTo(part.position.x + axis.x * 20, part.position.y + axis.y * 20)
        }
      }
    } else {
      for(let j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
        part = parts[j]
        for(let k = 0; k < part.axes.length; k++) {
          // render a single axis indicator
          c.moveTo(part.position.x, part.position.y)
          c.lineTo(
            (part.vertices[0].x + part.vertices[part.vertices.length - 1].x) / 2,
            (part.vertices[0].y + part.vertices[part.vertices.length - 1].y) / 2
          )
        }
      }
    }
  }

  if(options.wireframes) {
    c.strokeStyle = 'indianred'
    c.lineWidth = 1
  } else {
    c.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    c.globalCompositeOperation = 'overlay'
    c.lineWidth = 2
  }

  c.stroke()
  c.globalCompositeOperation = 'source-over'
}

/**
 * Draws body positions
 * @private
 * @method bodyPositions
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyPositions = function (render, bodies, context) {
  const c = context,
    options = render.options
  let body,
    part

  c.beginPath()

  // render current positions
  for(let i = 0; i < bodies.length; i++) {
    body = bodies[i]

    if(!body.render.visible) { continue }

    // handle compound parts
    for(let k = 0; k < body.parts.length; k++) {
      part = body.parts[k]
      c.arc(part.position.x, part.position.y, 3, 0, 2 * Math.PI, false)
      c.closePath()
    }
  }

  if(options.wireframes) {
    c.fillStyle = 'indianred'
  } else {
    c.fillStyle = 'rgba(0,0,0,0.5)'
  }
  c.fill()

  c.beginPath()

  // render previous positions
  for(let i = 0; i < bodies.length; i++) {
    body = bodies[i]
    if(body.render.visible) {
      c.arc(body.positionPrev.x, body.positionPrev.y, 2, 0, 2 * Math.PI, false)
      c.closePath()
    }
  }

  c.fillStyle = 'rgba(255,165,0,0.8)'
  c.fill()
}

/**
 * Draws body velocity
 * @private
 * @method bodyVelocity
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyVelocity = function (render, bodies, context) {
  const c = context

  c.beginPath()

  for(let i = 0; i < bodies.length; i++) {
    const body = bodies[i]

    if(!body.render.visible) {
      continue
    }c.moveTo(body.position.x, body.position.y)
    c.lineTo(body.position.x + (body.position.x - body.positionPrev.x) * 2, body.position.y + (body.position.y - body.positionPrev.y) * 2)
  }

  c.lineWidth = 3
  c.strokeStyle = 'cornflowerblue'
  c.stroke()
}

/**
 * Draws body ids
 * @private
 * @method bodyIds
 * @param {render} render
 * @param {body[]} bodies
 * @param {RenderingContext} context
 */
Render.bodyIds = function (render, bodies, context) {
  const c = context

  for(let i = 0; i < bodies.length; i++) {
    if(!bodies[i].render.visible) {
      continue
    } const parts = bodies[i].parts
    for(let j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
      const part = parts[j]
      c.font = '12px Arial'
      c.fillStyle = 'rgba(255,255,255,0.5)'
      c.fillText(part.id, part.position.x + 10, part.position.y - 10)
    }
  }
}

/**
 * Description
 * @private
 * @method collisions
 * @param {render} render
 * @param {pair[]} pairs
 * @param {RenderingContext} context
 */
Render.collisions = function (render, pairs, context) {
  const c = context,
    options = render.options

  let pair,
    collision

  c.beginPath()

  // render collision positions
  for(let i = 0; i < pairs.length; i++) {
    pair = pairs[i]

    if(!pair.isActive) {
      continue
    }collision = pair.collision
    for(let j = 0; j < pair.activeContacts.length; j++) {
      const contact = pair.activeContacts[j],
        vertex = contact.vertex
      c.rect(vertex.x - 1.5, vertex.y - 1.5, 3.5, 3.5)
    }
  }

  if(options.wireframes) {
    c.fillStyle = 'rgba(255,255,255,0.7)'
  } else {
    c.fillStyle = 'orange'
  }
  c.fill()

  c.beginPath()

  // render collision normals
  for(let i = 0; i < pairs.length; i++) {
    pair = pairs[i]

    if(!pair.isActive) {
      continue
    }collision = pair.collision

    if(pair.activeContacts.length > 0) {
      let normalPosX = pair.activeContacts[0].vertex.x,
        normalPosY = pair.activeContacts[0].vertex.y

      if(pair.activeContacts.length === 2) {
        normalPosX = (pair.activeContacts[0].vertex.x + pair.activeContacts[1].vertex.x) / 2
        normalPosY = (pair.activeContacts[0].vertex.y + pair.activeContacts[1].vertex.y) / 2
      }

      if(collision.bodyB === collision.supports[0].body || collision.bodyA.isStatic === true) {
        c.moveTo(normalPosX - collision.normal.x * 8, normalPosY - collision.normal.y * 8)
      } else {
        c.moveTo(normalPosX + collision.normal.x * 8, normalPosY + collision.normal.y * 8)
      }

      c.lineTo(normalPosX, normalPosY)
    }
  }

  if(options.wireframes) {
    c.strokeStyle = 'rgba(255,165,0,0.7)'
  } else {
    c.strokeStyle = 'orange'
  }

  c.lineWidth = 1
  c.stroke()
}

/**
 * Description
 * @private
 * @method separations
 * @param {render} render
 * @param {pair[]} pairs
 * @param {RenderingContext} context
 */
Render.separations = function (render, pairs, context) {
  const c = context,
    options = render.options

  let pair,
    collision,
    bodyA,
    bodyB

  c.beginPath()

  // render separations
  for(let i = 0; i < pairs.length; i++) {
    pair = pairs[i]

    if(!pair.isActive) {
      continue
    }collision = pair.collision
    bodyA = collision.bodyA
    bodyB = collision.bodyB

    let k = 1

    if(!bodyB.isStatic && !bodyA.isStatic) k = 0.5
    if(bodyB.isStatic) k = 0

    c.moveTo(bodyB.position.x, bodyB.position.y)
    c.lineTo(bodyB.position.x - collision.penetration.x * k, bodyB.position.y - collision.penetration.y * k)

    k = 1

    if(!bodyB.isStatic && !bodyA.isStatic) k = 0.5
    if(bodyA.isStatic) k = 0

    c.moveTo(bodyA.position.x, bodyA.position.y)
    c.lineTo(bodyA.position.x + collision.penetration.x * k, bodyA.position.y + collision.penetration.y * k)
  }

  if(options.wireframes) {
    c.strokeStyle = 'rgba(255,165,0,0.5)'
  } else {
    c.strokeStyle = 'orange'
  }
  c.stroke()
}

/**
 * Description
 * @private
 * @method grid
 * @param {render} render
 * @param {grid} grid
 * @param {RenderingContext} context
 */
Render.grid = function (render, grid, context) {
  const c = context,
    options = render.options

  if(options.wireframes) {
    c.strokeStyle = 'rgba(255,180,0,0.1)'
  } else {
    c.strokeStyle = 'rgba(255,180,0,0.5)'
  }

  c.beginPath()

  const bucketKeys = Common.keys(grid.buckets)

  for(let i = 0; i < bucketKeys.length; i++) {
    const bucketId = bucketKeys[i]

    if(grid.buckets[bucketId].length < 2) {
      continue
    } const region = bucketId.split(/C|R/)
    c.rect(
      0.5 + parseInt(region[1], 10) * grid.bucketWidth,
      0.5 + parseInt(region[2], 10) * grid.bucketHeight,
      grid.bucketWidth,
      grid.bucketHeight
    )
  }

  c.lineWidth = 1
  c.stroke()
}

/**
 * Description
 * @private
 * @method inspector
 * @param {inspector} inspector
 * @param {RenderingContext} context
 */
Render.inspector = function (inspector, context) {
  const selected = inspector.selected,
    render = inspector.render,
    options = render.options
  let bounds
  if(options.hasBounds) {
    const boundsWidth = render.bounds.max.x - render.bounds.min.x,
      boundsHeight = render.bounds.max.y - render.bounds.min.y,
      boundsScaleX = boundsWidth / render.options.width,
      boundsScaleY = boundsHeight / render.options.height

    context.scale(1 / boundsScaleX, 1 / boundsScaleY)
    context.translate(-render.bounds.min.x, -render.bounds.min.y)
  }

  for(let i = 0; i < selected.length; i++) {
    const item = selected[i].data

    context.translate(0.5, 0.5)
    context.lineWidth = 1
    context.strokeStyle = 'rgba(255,165,0,0.9)'
    context.setLineDash([1, 2])
    let point = item.pointA
    switch (item.type) {
      case 'body':

        // render body selections
        bounds = item.bounds
        context.beginPath()
        context.rect(
          Math.floor(bounds.min.x - 3), Math.floor(bounds.min.y - 3),
          Math.floor(bounds.max.x - bounds.min.x + 6), Math.floor(bounds.max.y - bounds.min.y + 6)
        )
        context.closePath()
        context.stroke()

        break

      case 'constraint':

        // render constraint selections
        if(item.bodyA) { point = item.pointB }
        context.beginPath()
        context.arc(point.x, point.y, 10, 0, 2 * Math.PI)
        context.closePath()
        context.stroke()

        break
      default:
        break
    }

    context.setLineDash([])
    context.translate(-0.5, -0.5)
  }

  // render selection region
  if(inspector.selectStart !== null) {
    context.translate(0.5, 0.5)
    context.lineWidth = 1
    context.strokeStyle = 'rgba(255,165,0,0.6)'
    context.fillStyle = 'rgba(255,165,0,0.1)'
    bounds = inspector.selectBounds
    context.beginPath()
    context.rect(
      Math.floor(bounds.min.x), Math.floor(bounds.min.y),
      Math.floor(bounds.max.x - bounds.min.x), Math.floor(bounds.max.y - bounds.min.y)
    )
    context.closePath()
    context.stroke()
    context.fill()
    context.translate(-0.5, -0.5)
  }

  if(options.hasBounds) { context.setTransform(1, 0, 0, 1, 0, 0) }
}

/**
 * Applies the background to the canvas using CSS.
 * @method applyBackground
 * @private
 * @param {render} render
 * @param {string} background
 */
function _applyBackground(render, background) {
  let cssBackground = background

  if(/(jpg|gif|png)$/.test(background)) { cssBackground = `url(${background})` }

  render.canvas.style.background = cssBackground
  render.canvas.style.backgroundSize = 'contain'
  render.currentBackground = background
}

/*
 *
 *  Events Documentation
 *
 */

/**
 * Fired before rendering
 *
 * @event beforeRender
 * @param {} event An event object
 * @param {number} event.timestamp The engine.timing.timestamp of the event
 * @param {} event.source The source object of the event
 * @param {} event.name The name of the event
 */

/**
 * Fired after rendering
 *
 * @event afterRender
 * @param {} event An event object
 * @param {number} event.timestamp The engine.timing.timestamp of the event
 * @param {} event.source The source object of the event
 * @param {} event.name The name of the event
 */

/*
 *
 *  Properties Documentation
 *
 */

/**
 * A back-reference to the `Matter.Render` module.
 *
 * @property controller
 * @type render
 */

/**
 * A reference to the `Matter.Engine` instance to be used.
 *
 * @property engine
 * @type engine
 */

/**
 * A reference to the element where the canvas is to be inserted (if `render.canvas` has not been specified)
 *
 * @property element
 * @type HTMLElement
 * @default null
 */

/**
 * The canvas element to render to. If not specified, one will be created if `render.element` has been specified.
 *
 * @property canvas
 * @type HTMLCanvasElement
 * @default null
 */

/**
 * The configuration options of the renderer.
 *
 * @property options
 * @type {}
 */

/**
 * The target width in pixels of the `render.canvas` to be created.
 *
 * @property options.width
 * @type number
 * @default 800
 */

/**
 * The target height in pixels of the `render.canvas` to be created.
 *
 * @property options.height
 * @type number
 * @default 600
 */

/**
 * A flag that specifies if `render.bounds` should be used when rendering.
 *
 * @property options.hasBounds
 * @type boolean
 * @default false
 */

/**
 * A `Bounds` object that specifies the drawing view region.
 * Rendering will be automatically transformed and scaled to fit within the canvas size (`render.options.width` and `render.options.height`).
 * This allows for creating views that can pan or zoom around the scene.
 * You must also set `render.options.hasBounds` to `true` to enable bounded rendering.
 *
 * @property bounds
 * @type bounds
 */

/**
 * The 2d rendering context from the `render.canvas` element.
 *
 * @property context
 * @type CanvasRenderingContext2D
 */

/**
 * The sprite texture cache.
 *
 * @property textures
 * @type {}
 */
