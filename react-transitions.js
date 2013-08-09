// copyright 2013 facebook, apache2 license

// Credit: http://www.sitepoint.com/css3-animation-javascript-event-handlers/
var END_EVENT_NAMES = [
  'animationend', 'webkitAnimationEnd', 'oanimationend', 'MSAnimationEnd',
  'transitionend', 'webkitTransitionEnd', 'otransitionend', 'MSTransitionEnd'
];

// Basic functions to manipulate raw DOM CSS classes
// It's cool to use classList because pre-IE10 doesn't have CSS3 stuff
function removeClasses(node, classes) {
  if (node.classList) {
    classes.map(node.classList.remove.bind(node.classList));
  }
}

function addClass(node, className) {
  if (node.classList) {
    node.classList.add(className);
  }
}

// Perform an actual DOM animation. This takes care of a few things:
// - Adding the second CSS class to trigger the transition
// - Listening for the finish event
// - Cleaning up the css (unless noReset is true)
function animateDOMNode(node, animationName, animationType, noReset, finishCallback) {
  var className = animationName + '-' + animationType;
  var activeClassName = className + '-active';

  function endListener() {
    if (!noReset) {
      // Usually this means you're about to remove the node if you want to leave it
      // in its animated state.
      removeClasses(node, [className, activeClassName]);
    }
    END_EVENT_NAMES.map(function(eventName) {
      node.removeEventListener(eventName, endListener, false);
    });
    // Usually this optional callback is used for informing an owner of an exit animation
    // and telling it to remove the child.
    finishCallback && finishCallback();
  }
  END_EVENT_NAMES.map(function(eventName) {
    node.addEventListener(eventName, endListener, false);
  });
  addClass(node, className);
  // Need to do this to actually trigger a transition.
  setTimeout(addClass.bind(this, node, activeClassName), 0);
}

// This component is simply responsible for watching when its single child
// changes to undefined and animating the old child out. It does this by recording
// its old child in savedChildren when it detects this event is about to occur.
var AnimateSingle = React.createClass({
  componentWillReceiveProps: function(nextProps) {
    if (!nextProps.children && this.props.children) {
      this.savedChildren = this.props.children;
    }
  },
  componentDidMount: function(node) {
    animateDOMNode(node, this.props.name, 'enter');
  },
  componentDidUpdate: function(prevProps, prevState, node) {
    if (prevProps.children && !this.props.children) {
      animateDOMNode(node, this.props.name, 'leave', true, this.props.onDoneLeaving);
    }
  },
  render: function() {
    return this.props.children || this.savedChildren;
  }
});

// To save memory props.children can either be an object holding multiple children or
// a React component or a primitive value. This ensures that we have an object with
// keys.
function getChildren(props) {
  var pChildren = props.children;
  if (!pChildren || typeof pChildren !== 'object' || pChildren.isMounted) {
    pChildren = {__singleton: pChildren};
  }
  return pChildren;
}

// Some sugar to get the key set. Basically the same as the children object except
// it does not have references to big objects in it.
function getKeySet(children) {
  var keySet = {};
  for (var key in children) {
    if (!children.hasOwnProperty(key)) {
      continue;
    }
    keySet[key] = true;
  }
  return keySet;
}

// OK, here is where things start to get intense. When you're adding or removing children
// some may be added or removed in the same pass. We want to show *both* since we want to
// simultaneously animate in and out. This is our best-guess at how it should look with
// respect to ordering. In the future we may expose some of the utilities in ReactMultiChild
// to make this easy, but for now React itself does not directly have this concept so we
// implement it here:
function mergeKeySets(prev, next) {
  var keySet = {};
  var prevKeys = Object.keys(prev).concat(['.mergeKeySets-tail']);
  var nextKeys = Object.keys(next).concat(['.mergeKeySets-tail']);
  var i;
  for (i = 0; i < prevKeys.length - 1; i++) {
    var prevKey = prevKeys[i];
    if (next[prevKey]) {
      continue;
    }
    // This key is not in the new set. Place it in our
    // best guess where it should go. We do this by searching
    // for a key after the current one in prevKeys that is
    // still in nextKeys, and inserting right before it.
    var insertPos = -1;
    for (var j = i + 1; j < prevKeys.length; j++) {
      insertPos = nextKeys.indexOf(prevKeys[j]);
      if (insertPos >= 0) {
        break;
      }
    }
    // Insert before insertPos
    nextKeys.splice(insertPos, 0, prevKey);
  }
  for (i = 0; i < nextKeys.length - 1; i++) {
    keySet[nextKeys[i]] = true;
  }
  return keySet;
}

// Here is the end-user API!
var Animate = React.createClass({
  getInitialState: function() {
    // Remember: we want to show all components animating in AND out at
    // the same time. This state variable holds the union of both the old
    // child keys and the new ones.
    return {currentKeys: getKeySet(getChildren(this.props))};
  },
  componentWillReceiveProps: function(nextProps) {
    if (this.props.children !== nextProps.children) {
      // This is where we actually take the union of both sets of keys
      this.setState({
        currentKeys: mergeKeySets(
          this.state.currentKeys,
          getKeySet(getChildren(nextProps))
        )
      });
    }
  },
  renderChildren: function() {
    var children = {};
    var pChildren = getChildren(this.props);
    for (var key in this.state.currentKeys) {
      // Here is how we keep the nodes in the DOM. AnimateSingle knows how
      // to hold onto its child if it changes to undefined. Here, we may look
      // up an old key in the new children, and it may switch to undefined. React's
      // reconciler will keep the AnimateSingle instance alive such that we can
      // animate it.
      children[key] = AnimateSingle({
        name: this.props.name,
        onDoneLeaving: this.handleDoneLeaving.bind(this, key)
      }, pChildren[key]);
    }
    return children;
  },
  handleDoneLeaving: function(key) {
    // When the leave animation finishes, we should blow away the actual DOM node.
    var currentKeys = this.state.currentKeys;
    // Normally you don't mutate state, but the alternative is to create a new object
    // for no reason. This is easier and faster.
    delete currentKeys[key];
    this.setState({currentKeys: currentKeys});
  },
  getDefaultProps: function() {
    return {component: React.DOM.div};
  },
  render: function() {
    // The one shortcoming of the API is that this component needs to render a real DOM node
    // into the document. Sometimes you want a <div> to contain them, other times you want
    // a <ul>. You can pass a component prop to control this (we default to <div>).
    return this.transferPropsTo(this.props.component(null, this.renderChildren()));
  }
});

window.Animate = Animate;