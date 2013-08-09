// copyright 2013 facebook, apache2 license

// Credit: http://www.sitepoint.com/css3-animation-javascript-event-handlers/
var END_EVENT_NAMES = [
  'animationend', 'webkitAnimationEnd', 'oanimationend', 'MSAnimationEnd',
  'transitionend', 'webkitTransitionEnd', 'otransitionend', 'MSTransitionEnd'
];

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

function animateDOMNode(node, animationName, animationType, noReset, finishCallback) {
  var className = animationName + '-' + animationType;
  var activeClassName = className + '-active';
    // remove when done
  function endListener() {
    if (!noReset) {
      removeClasses(node, [className, activeClassName]);
    }
    END_EVENT_NAMES.map(function(eventName) {
      node.removeEventListener(eventName, endListener, false);
    });
    finishCallback && finishCallback();
  }
  END_EVENT_NAMES.map(function(eventName) {
    node.addEventListener(eventName, endListener, false);
  });
  addClass(node, className);
  setTimeout(addClass.bind(this, node, activeClassName), 0);
}

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

function getChildren(props) {
  var pChildren = props.children;
  if (!pChildren || typeof pChildren !== 'object' || pChildren.isMounted) {
    pChildren = {__singleton: pChildren};
  }
  return pChildren;
}

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

var Animate = React.createClass({
  getInitialState: function() {
    return {currentKeys: getKeySet(getChildren(this.props))};
  },
  componentWillReceiveProps: function(nextProps) {
    if (this.props.children !== nextProps.children) {
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
      children[key] = AnimateSingle({
        name: this.props.name,
        onDoneLeaving: this.handleDoneLeaving.bind(this, key)
      }, pChildren[key]);
    }
    return children;
  },
  handleDoneLeaving: function(key) {
    var currentKeys = this.state.currentKeys;
    // TODO: this is a mutation, but I know what I'm doing.
    delete currentKeys[key];
    this.setState({currentKeys: currentKeys});
  },
  render: function() {
    var componentClass = this.props.component || React.DOM.div;
    return this.transferPropsTo(componentClass(null, this.renderChildren()));
  }
});

window.Animate = Animate;