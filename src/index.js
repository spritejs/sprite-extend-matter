// for webpack build
import Matter from 'matter-js'
import Render from './render'

Matter.CanvasRender = Matter.Render
Matter.Render = Render

module.exports = Matter
