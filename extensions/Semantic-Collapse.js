//
//  Implements the ability to have long expressions
//  collapse automatically on screen size changes.
//
(function (HUB) {
  var Collapse = MathJax.Extension.SemanticCollapse = {
    version: "1.0",
    config: HUB.CombineConfig("SemanticCollapse",{
      disabled: false
    }),

    /*****************************************************************/

    Enable: function () {this.config.disabled = false},
    Disable: function () {this.config.disabled = true},
    
    Startup: function () {
      //
      //  Add the filter into the post-input hooks (priority 150, so other
      //  hooks run first, in particular, the enrichment and complexity hooks).
      //
      HUB.postInputHooks.Add(["Filter",Collapse],150);
      
      //
      //  Add the auto-collapsing
      //
      HUB.Queue(function () {return Collapse.CollapseWideMath()});
      //
      //  Add a resize handler to check for math that needs
      //  to be collapsed or expanded.
      //
      if (window.addEventListener) window.addEventListener("resize",Collapse.resizeHandler,false);
      else if (window.attachEvent) window.attachEvent("onresize",Collapse.resizeHandler);
      else window.onresize = Collapse.resizeHandler;
    },
    
    //
    //  If the math is block-level (or in an element "by itself"), then
    //  add the SRE actions for this element.
    //
    Filter: function (jax,id,script) {
      if (!jax.enriched || this.config.disabled) return;
      if (jax.root.Get("display") === "block" ||
          script.parentNode.childNodes.length <= 3) {
        jax.root.SRE = {action: this.Actions(jax.root)};
      }
    },
    //
    //  Produce an array of collapsible actions
    //  sorted by depth and complexity
    //
    Actions: function (node) {
      var actions = [];
      this.getActions(node,0,actions);
      return this.sortActions(actions);
    },
    getActions: function (node,depth,actions) {
      if (node.isToken) return;
      depth++;
      for (var i = 0, m = node.data.length; i < m; i++) {
        if (node.data[i]) {
          var child = node.data[i];
          if (child.collapsible) {
            if (!actions[depth]) actions[depth] = [];
            actions[depth].push(child);
            this.getActions(child.data[1],depth,actions);
          } else {
            this.getActions(child,depth,actions);
          }
        }
      }
    },
    sortActions: function (actions) {
      var ACTIONS = [];
      for (var i = 0, m = actions.length; i < m; i++) {
        if (actions[i]) ACTIONS = ACTIONS.concat(actions[i].sort(this.sortActionsBy));
      }
      return ACTIONS;
    },
    sortActionsBy: function (a,b) {
      a = a.data[1].complexity; b = b.data[1].complexity;
      return (a < b ? -1 : a > b ? 1 : 0);
    },
    
    /*****************************************************************/
    /*
     *  These routines implement the automatic collapsing of equations
     *  based on container widths.
     */

    //
    //  Find math that is too wide and collapse it.
    //
    CollapseWideMath: function (element) {
      if (this.config.disabled) return;
      this.GetContainerWidths(element);
      var jax = HUB.getAllJax(element);
      var state = {collapse: [], jax: jax, m: jax.length, i: 0, changed:false};
      return this.collapseState(state);
    },
    collapseState: function (state) {
      while (state.i < state.m) {
        var jax = state.jax[state.i], collapse = state.collapse;
        var SRE = jax.root.SRE; state.changed = false;
        if (SRE && SRE.action.length) {
          if (SRE.cwidth < SRE.m || SRE.cwidth > SRE.M) {
            var restart = this.getActionWidths(jax,state); if (restart) return restart;
            this.collapseActions(SRE,state);
            if (state.changed) collapse.push(jax.SourceElement());
          }
        }
        state.i++;
      }
      if (collapse.length === 0) return;
      if (collapse.length === 1) collapse = collapse[0];
      return HUB.Rerender(collapse);
    },
    
    //
    //  Find the actions that need to be collapsed to acheive
    //  the correct width, and retain the sizes that would cause
    //  the equation to be expanded or collapsed further.
    //
    collapseActions: function (SRE,state) {
      var w = SRE.width, m = w, M = 1000000;
      for (var j = SRE.action.length-1; j >= 0; j--) {
        var action = SRE.action[j], selection = action.selection;
        if (w > SRE.cwidth) {
          action.selection = 1;
          m = action.SREwidth; M = w;
        } else {
          action.selection = 2;
        }
        w = action.SREwidth;
        if (SRE.DOMupdate) {
          document.getElementById(action.id).setAttribute("selection",action.selection);
        } else if (action.selection !== selection) {
          state.changed = true;
        }
      }
      SRE.m = m; SRE.M = M;
    },

    //
    //  Get the widths of the different collapsings,
    //  trapping any restarts, and restarting the process
    //  when the event has occurred.
    //
    getActionWidths: function (jax,state) {
      if (!jax.root.SRE.actionWidths) {
        MathJax.OutputJax[jax.outputJax].getMetrics(jax);
        try {this.computeActionWidths(jax)} catch (err) {
          if (!err.restart) throw err;
          return MathJax.Callback.After(["collapseState",this,state],err.restart);
        }
        state.changed = true;
      }
      return null;
    },
    //
    //  Compute the action widths by collapsing each maction,
    //  and recording the width of the complete equation.
    //
    computeActionWidths: function (jax) {
      var SRE = jax.root.SRE, actions = SRE.action, j, state = {};
      SRE.width = jax.sreGetRootWidth(state);
      for (j = actions.length-1; j >= 0; j--) actions[j].selection = 2;
      for (j = actions.length-1; j >= 0; j--) {
        var action = actions[j];
        if (action.SREwidth == null) {
          action.selection = 1;
          action.SREwidth = jax.sreGetActionWidth(state,action);
        }
      }
      SRE.actionWidths = true;
    },

    //
    //  Get the widths of the containers of tall the math elements
    //  that can be collapsed (so we can tell which ones NEED to be
    //  collapsed).  Do this in a way that only causes two reflows.
    //
    GetContainerWidths: function (element) {
      var JAX = HUB.getAllJax(element);
      var i, m, script, span = MathJax.HTML.Element("span",{style:{display:"block"}});
      var math = [], jax, root;
      for (i = 0, m = JAX.length; i < m; i++) {
        jax = JAX[i], root = jax.root, SRE = root.SRE;
        if (SRE && SRE.action.length) {
          if (SRE.width == null) {
            jax.sreGetMetrics();
            SRE.m = SRE.width; SRE.M = 1000000;
          }
          script = jax.SourceElement();
          script.previousSibling.style.display = "none";
          script.parentNode.insertBefore(span.cloneNode(false),script);
          math.push([jax,script]);
        }
      }
      for (i = 0, m = math.length; i < m; i++) {
        jax = math[i][0], script = math[i][1];
        if (script.previousSibling.offsetWidth)
          jax.root.SRE.cwidth = script.previousSibling.offsetWidth * jax.root.SRE.em;
      }
      for (i = 0, m = math.length; i < m; i++) {
        jax = math[i][0], script = math[i][1];
        script.parentNode.removeChild(script.previousSibling);
        script.previousSibling.style.display = "";
      }
    },

    /*****************************************************************/

    //
    //  A resize handler that can be tied to the window resize event
    //  to collapse math automatically on resize.
    //

    timer: null,
    running: false,
    retry: false,
    saved_delay: 0,
    
    resizeHandler: function (event) {
      if (Collapse.running) {Collapse.retry = true; return}
      if (Collapse.timer) clearTimeout(Collapse.timer);
      Collapse.timer = setTimeout(Collapse.resizeAction, 100);
    },
    resizeAction: function () {
      Collapse.timer = null;
      Collapse.running = true;
      HUB.Queue(
        function () {
          //
          //  Prevent flicker between input and output phases.
          //
          Collapse.saved_delay = HUB.processSectionDelay;
          HUB.processSectionDelay = 0;
        },
        ["CollapseWideMath",Collapse],
        ["resizeCheck",Collapse]
      );
    },
    resizeCheck: function () {
      Collapse.running = false;
      HUB.processSectionDelay = Collapse.saved_delay;
      if (Collapse.retry) {
        Collapse.retry = false;
        setTimeout(Collapse.resizeHandler,0);
      }
    }
  };
})(MathJax.Hub);


/*****************************************************************/
/*
 *  Add methods to the ElementJax and OutputJax to get the
 *  widths of the collapsed elements.
 */

//
//  Add SRE methods to ElementJax.
//
MathJax.ElementJax.Augment({
  sreGetMetrics: function () {
    MathJax.OutputJax[this.outputJax].sreGetMetrics(this,this.root.SRE);
  },
  sreGetRootWidth: function (state) {
    return MathJax.OutputJax[this.outputJax].sreGetRootWidth(this,state);
  },
  sreGetActionWidth: function (state,action) {
    return MathJax.OutputJax[this.outputJax].sreGetActionWidth(this,state,action);
  }
});

//
//  Add default methods to base OutputJax class.
//
MathJax.OutputJax.Augment({
  getMetrics: function () {},  // make sure it is defined
  sreGetMetrics: function (jax,SRE) {SRE.cwidth = 1000000; SRE.width = 0; SRE.em = 12},
  sreGetRootWidth: function (jax,state) {return 0},
  sreGetActionWidth: function (jax,state,action) {return 0}
});

//
//  Specific implementations for HTML-CSS output.
//
MathJax.Hub.Register.StartupHook("HTML-CSS Jax Ready",function () {
  MathJax.OutputJax["HTML-CSS"].Augment({
    sreGetMetrics: function (jax,SRE) {
      SRE.width = jax.root.data[0].HTMLspanElement().parentNode.bbox.w;
      SRE.em = 1 / jax.HTMLCSS.em / jax.HTMLCSS.scale;
    },
    sreGetRootWidth: function (jax,state) {
      var html = jax.root.data[0].HTMLspanElement();
      state.box = html.parentNode;
      return state.box.bbox.w;
    },
    sreGetActionWidth: function (jax,state,action) {
      return jax.root.data[0].toHTML(state.box).bbox.w;
    }
  });
});

//
//  Specific implementations for SVG output.
//
MathJax.Hub.Register.StartupHook("SVG Jax Ready",function () {
  MathJax.Hub.Config({SVG: {addMMLclasses: true}});
  MathJax.OutputJax.SVG.Augment({
    getMetrics: function (jax) {
      this.em = MathJax.ElementJax.mml.mbase.prototype.em = jax.SVG.em; this.ex = jax.SVG.ex;
      this.linebreakWidth = jax.SVG.lineWidth; this.cwidth = jax.SVG.cwidth;
    },
    sreGetMetrics: function (jax,SRE) {
      SRE.width = jax.root.SVGdata.w/1000;
      SRE.em = 1/jax.SVG.em;
    },
    sreGetRootWidth: function (jax,state) {
      state.span = document.getElementById(jax.inputID+"-Frame");
      return jax.root.SVGdata.w/1000;
    },
    sreGetActionWidth: function (jax,state,action) {
      this.mathDiv = state.span;
      state.span.appendChild(this.textSVG);
      try {var svg = jax.root.data[0].toSVG()} catch(err) {var error = err}
      state.span.removeChild(this.textSVG);
      if (error) throw error;  // can happen when a restart is needed
      return jax.root.data[0].SVGdata.w/1000;
    }
  });
});

//
//  Specific implementations for CommonHTML output.
//
MathJax.Hub.Register.StartupHook("CommonHTML Jax Ready",function () {
  MathJax.OutputJax.CommonHTML.Augment({
    sreGetMetrics: function (jax,SRE) {
      SRE.width = jax.root.CHTML.w;
      SRE.em = 1 / jax.CHTML.em / jax.CHTML.scale;
    },
    sreGetRootWidth: function (jax,state) {
      state.span = document.getElementById(jax.inputID+"-Frame").firstChild;
      state.tmp = document.createElement("span");
      state.tmp.className = state.span.className;
      return jax.root.CHTML.w / jax.CHTML.scale;
    },
    sreGetActionWidth: function (jax,state,action) {
      state.span.parentNode.replaceChild(state.tmp,state.span);
      MathJax.OutputJax.CommonHTML.CHTMLnode = state.tmp;
      try {jax.root.data[0].toCommonHTML(state.tmp)} catch (err) {var error = err}
      state.tmp.parentNode.replaceChild(state.span,state.tmp);
      if (error) throw error;  // can happen when a restart is needed
      return jax.root.data[0].CHTML.w / jax.CHTML.scale;
    }
  });
});

//
//  Specific implementations for NativeMML output.
//
MathJax.Hub.Register.StartupHook("NativeMML Jax Ready",function () {
  var dummyRestart = MathJax.Callback({}); dummyRestart();
  MathJax.OutputJax.NativeMML.Augment({
    sreGetMetrics: function (jax,SRE) {
      var span = document.getElementById(jax.inputID+"-Frame");
      SRE.width = span.offsetWidth;
      SRE.em = 1; SRE.DOMupdate = true;
    },
    sreGetRootWidth: function (jax,state) {
      state.span = document.getElementById(jax.inputID+"-Frame").firstChild;
      return state.span.offsetWidth;
    },
    sreGetActionWidth: function (jax,state,action) {
      var maction = document.getElementById(action.id);
      maction.setAttribute("selection",1);
      var w = state.span.offsetWidth;
      return w;
    }
  });
});


/*****************************************************************/

//
//  Load the Semantic-Compmlexity extension and
//  signal the start up when that has loaded.
//
MathJax.Ajax.Require("[RespEq]/Semantic-Complexity.js");
MathJax.Hub.Register.StartupHook("Semantic Complexity Ready", function () {
  MathJax.Extension.SemanticCollapse.Startup(); // Initialize the collapsing process
  MathJax.Hub.Startup.signal.Post("Semantic Collapse Ready");
  MathJax.Ajax.loadComplete("[RespEq]/Semantic-Collapse.js");
});

