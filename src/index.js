import Matter from './matter';

// auto use
if(typeof window !== 'undefined' && window.spritejs) {
  window.spritejs.use(install);
}

export function install({use}) {
  return [
    Matter,
  ].reduce((pkg, Node) => {
    return Object.assign(pkg, use(Node));
  }, {});
}