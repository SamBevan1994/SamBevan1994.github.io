//
// Connection to SRE explorer.
//
MathJax.Hub.Register.StartupHook('Sre Ready', function() {
  var FALSE, KEY;
  var SETTINGS = MathJax.Hub.config.menuSettings;
  var swipesadded = false;
  var mc = null;

  MathJax.Hub.Register.StartupHook('MathEvents Ready', function() {
    FALSE = MathJax.Extension.MathEvents.Event.False;
    KEY = MathJax.Extension.MathEvents.Event.KEY;
  });




  
  var Assistive = MathJax.Extension.Assistive = {
    version: "1.0",
    //
    // Default configurations.
    //
    default: {
      walker: 'dummy',
      highlight: 'none',
      background: 'blue',
      foreground: 'black',
      speech: true,
      subtitle: false,
      // Configuration option only.
      generateSpeech: true
    },
    prefix: 'Assistive-',
    
    addMenuOption: function(key, value) {
      SETTINGS[Assistive.prefix + key] = value;      
    },

    addDefaults: function() {
      var keys = Object.keys(Assistive.default);
      for (var i = 0, key; key = keys[i]; i++) {
        if (typeof(SETTINGS[Assistive.prefix + key]) === 'undefined') {
          Assistive.addMenuOption(key, Assistive.default[key]);
        }
      }
      Explorer.Reset();
    },

    setOption: function(key, value) {
      if (SETTINGS[Assistive.prefix + key] === value) return;
      Assistive.addMenuOption(key, value);
      Explorer.Reset();
    },

    getOption: function(key) {
      return SETTINGS[Assistive.prefix + key];
    }
    
  };
  
  var LiveRegion = MathJax.Object.Subclass({
    div: null,
    inner: null,
    Init: function() {
      this.div = LiveRegion.Create('assertive');
      this.inner = MathJax.HTML.addElement(this.div,'div');
    },
    //
    // Adds the speech div.
    //
    Add: function() {
      if (LiveRegion.announced) return;
      document.body.appendChild(this.div);
      LiveRegion.Announce();
    },
    //
    // Shows the live region as a subtitle of a node.
    //
    Show: function(node, highlighter) {
      this.div.classList.add('MJX_LiveRegion_Show');
      var rect = node.getBoundingClientRect();
      var bot = rect.bottom + 10 + window.pageYOffset;
      var left = rect.left + window.pageXOffset;
      this.div.style.top = bot + 'px';
      this.div.style.left = left + 'px';
      var color = highlighter.colorString();
      this.inner.style.backgroundColor = color.background;
      this.inner.style.color = color.foreground;
    },
    //
    // Takes the live region out of the page flow.
    //
    Hide: function(node) {
      this.div.classList.remove('MJX_LiveRegion_Show');
    },
    //
    // Clears the speech div.
    //
    Clear: function() {
      this.Update('');
      this.inner.style.top = '';
      this.inner.style.backgroundColor = '';
    },
    //
    // Speaks a string by poking it into the speech div.
    //
    Update: function(speech) {
      if (Assistive.getOption('speech')) {
        LiveRegion.Update(this.inner, speech);
      }
    }
  }, {
    ANNOUNCE: 'Navigatable Math in page. Explore with shift space.',
    announced: false,
    styles: {'.MJX_LiveRegion':
             {
               position: 'absolute', top:'0', height: '1px', width: '1px',
               padding: '1px', overflow: 'hidden'
             },
             '.MJX_LiveRegion_Show':
             {
               top:'0', position: 'absolute', width: 'auto', height: 'auto',
               padding: '0px 0px', opacity: 1, 'z-index': '202',
               left: 0, right: 0, 'margin': '0 auto',
               'background-color': 'white', 'box-shadow': '0px 10px 20px #888',
               border: '2px solid #CCCCCC'
             },
             '.MJX_DescriptionElement':
             {
               position: 'absolute', top:'0', height: '1px', width: '1px',
               padding: '1px', overflow: 'hidden'
             }
            },
    //
    // Creates a live region with a particular type.
    //
    Create: function(type) {
      var element = MathJax.HTML.Element(
        'div', {className: 'MJX_LiveRegion'});
      element.setAttribute('aria-live', type);
      return element;
    },
    //
    // Updates a live region's text content.
    //
    Update: MathJax.Hub.Browser.isPC ?
      function(div, speech) {
        div.textContent = '';
        setTimeout(function() {div.textContent = speech;}, 100);
      } : function(div, speech) {
        div.textContent = speech;
      },
    //
    // Speaks the announce string.
    //
    Announce: function() {
      if (LiveRegion.announced) return;
      LiveRegion.announced = true;
      MathJax.Ajax.Styles(LiveRegion.styles);
      var div = LiveRegion.Create('polite');
      document.body.appendChild(div);
      LiveRegion.Update(div, LiveRegion.ANNOUNCE);
      setTimeout(function() {document.body.removeChild(div);}, 1000);
    }
  });
  MathJax.Extension.Assistive.LiveRegion = LiveRegion;
  
  var Explorer = MathJax.Extension.Assistive.Explorer = {
    liveRegion: LiveRegion(),
    walker: null,
    highlighter: null,
    hoverer: null,
    flamer: null,
    speechDiv: null,
    earconFile: location.protocol +
      '//progressiveaccess.com/content/invalid_keypress' +
      (['Firefox', 'Chrome', 'Opera'].indexOf(MathJax.Hub.Browser.name) !== -1 ?
       '.ogg' : '.mp3'),
    focusEvent: MathJax.Hub.Browser.isFirefox ? 'blur' : 'focusout',
    //
    // Resets the explorer, rerunning methods not triggered by events.
    //
    Reset: function() {
      Explorer.FlameEnriched();
      sre.Engine.getInstance().speech = Assistive.getOption('generateSpeech');
    },
    //
    // Registers new Maths and adds a key event if it is enriched.
    //
    Register: function(msg) {
      var script = document.getElementById(msg[1]);
      if (script && script.id) {
        var jax = MathJax.Hub.getJaxFor(script.id);
        if (jax && jax.enriched) {
          Explorer.liveRegion.Add();
          Explorer.AddEvent(script);
        }
      }
    },
    //
    // Adds Aria attributes.
    //
    AddAria: function(math) {
      math.setAttribute('role', 'application');
      math.setAttribute('aria-label', 'Math');
    },
    //
    // Adds a key event to an enriched jax.
    //


    AddEvent: function(script) {
      var id = script.id + '-Frame';
      var sibling = script.previousSibling;
      if (sibling) {
        var math = sibling.id !== id ? sibling.firstElementChild : sibling;
        Explorer.AddAria(math);
        Explorer.AddMouseEvents(math);
        Explorer.AddHammerGestures(math);
        Explorer.AddTouchEvents(math);
        if (math.className === 'MathJax_MathML') {
          math = math.firstElementChild;
        }
  
        if (math) {
          math.onkeydown = Explorer.Keydown;
          //
          var speechGenerator = new sre.DirectSpeechGenerator();
          var span = math.querySelector('[data-semantic-speech]');
          if (span) {
            var speech = speechGenerator.getSpeech(span);
            if (speech) {
              math.setAttribute('aria-label', speech);
            }
          }
          //
          Explorer.Flame(math);
          math.addEventListener(
            Explorer.focusEvent,
            function(event) {
              if (Explorer.walker) Explorer.DeactivateWalker();
            });
          return;
        }
      }
    },
    //
    // Event execution on keydown. Subsumes the same method of MathEvents.
    //

    AddHammerGestures: function(node) {
      console.log('Adding Hammer Horror');
      var body = document.body;
      console.log("swipes added?: " + swipesadded);
     
      this.AddHammerSwipes(body);
      
      var tap = new Hammer(node);
      tap.on("tap", this.HammerTap);
      tap.on("press", this.HammerHold);
      tap.on("touchstart", function(event){
          if (Explorer.walker && Explorer.walker.isActive()) {
            event.srcEvent.stopPropagation();
            event.preventDefault();
            console.log("preventing event default (touchstarting)");
          };
      });
      tap.on("panleft", function(event) {
          if (Explorer.walker && Explorer.walker.isActive()) {
            console.log("Explorer Active so not swiping");
            event.srcEvent.stopPropagation();
            event.preventDefault();
          };
      });
      tap.on("panright", function(event) {
          if (Explorer.walker && Explorer.walker.isActive()) {
            console.log("Explorer Active so not swiping");
            event.srcEvent.stopPropagation();
            event.preventDefault();
          };
      });
      tap.on("panup", function(event) {
          if (Explorer.walker && Explorer.walker.isActive()) {
            console.log("Explorer Active so not swiping");
            event.srcEvent.stopPropagation();
            event.preventDefault();
          };
      });
      tap.on("pandown", function(event) {
          if (Explorer.walker && Explorer.walker.isActive()) {
            console.log("Explorer Active so not swiping");
            event.srcEvent.stopPropagation();
            event.preventDefault();
          };
      });
    },
    AddHammerSwipes: function(node){
      if (swipesadded == true) {
        console.log("destroying mc" + (mc == null))
        mc.destroy();
        console.log("Hammer Manager (mc) destroyed" + (mc == null));
      };
      console.log("adding swipes");
      mc = new Hammer.Manager(node);
      mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL}));
      mc.on("panstart", function(event){
        
        if ( Explorer.walker && Explorer.walker.isActive()) {
          console.log(mc +" starting panning so setting flag")
  
          event.srcEvent.stopPropagation();
          event.preventDefault();
          console.log("preventing event default (scrolling)");
        };
      });
      mc.on("panend", function (event){
        if (Explorer.walker && Explorer.walker.isActive()) {
          event.srcEvent.stopPropagation();
          event.preventDefault();
          if(event.direction == Hammer.DIRECTION_RIGHT){
            console.log("EVENT THAT COUNTS right?");
            Explorer.HammerSwipeRight(event);
          };
          if(event.direction == Hammer.DIRECTION_LEFT){
            console.log("EVENT THAT COUNTS left?");
            Explorer.HammerSwipeLeft(event);
          };
          if(event.direction == Hammer.DIRECTION_UP){
            console.log("EVENT THAT COUNTS up?");
            Explorer.HammerSwipeUp(event);
          };
          if(event.direction == Hammer.DIRECTION_DOWN){
            console.log("EVENT THAT COUNTS down?");
            Explorer.HammerSwipeDown(event);
          };
          pannable = true;
        };
      });
      swipesadded = true;
      console.log("added swipes");
    },
    HammerTap: function(event){
      console.log(event.type +" gesture detected.");
      event.preventDefault();
      event.srcEvent.stopPropagation();
      console.log("Hammer Tap Called");
      if (Explorer.walker && Explorer.walker.isActive()) {
        //Explorer.DeactivateWalker();
      };
      var math = event.target;
      var id = MathJax.Hub.getJaxFor(math).inputID + '-Frame';
      var newmath = document.getElementById(id);
      Explorer.ActivateWalker(newmath);
      console.log(math);
      console.log(newmath);
      
    },

    HammerHold: function(event){
      console.log(event.type +" gesture detected.");
      event.preventDefault();
      event.srcEvent.stopPropagation();
      console.log("Hammer Hold Called");
      if (Explorer.walker && Explorer.walker.isActive()) {
        Explorer.DeactivateWalker();
        console.log(Explorer.walker.isActive());
      };
      var math = event.target;
      var id = MathJax.Hub.getJaxFor(math).inputID + '-Frame';
      var newmath = document.getElementById(id);
      console.log(math);
      console.log(newmath);
      
    },

    HammerSwipeLeft: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        console.log('left?');
        var move = Explorer.walker.move(sre.EventUtil.KeyCode.LEFT);
        if (move === null) return;
        if (move) {
          console.log('updating');
          console.log(Explorer.walker.speech());
          Explorer.liveRegion.Update(Explorer.walker.speech());
          Explorer.Highlight();
        } else {
          Explorer.PlayEarcon();
        }
        FALSE(event);
        return;
       } else {
        console.log("Walker Not activated");
          //HammerTap(event);
       }
    },

    HammerSwipeRight: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        console.log('right?');
        var move = Explorer.walker.move(sre.EventUtil.KeyCode.RIGHT);
        if (move === null) return;
        if (move) {
          console.log('updating');
          console.log(Explorer.walker.speech());
          Explorer.liveRegion.Update(Explorer.walker.speech());
          Explorer.Highlight();
        } else {
          Explorer.PlayEarcon();
        }
        FALSE(event);
        return;
       } else {
        console.log("Walker Not activated");
          //HammerTap(event);
       }
    },

    HammerSwipeUp: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        console.log('up?');
        var move = Explorer.walker.move(sre.EventUtil.KeyCode.UP);
        if (move === null) return;
        if (move) {
          console.log('updating');
          console.log(Explorer.walker.speech());          
          Explorer.liveRegion.Update(Explorer.walker.speech());
          Explorer.Highlight();
        } else {
          Explorer.PlayEarcon();
        }
        FALSE(event);
        return;
       } else {
        console.log("Walker Not activated");
       }
    },

    HammerSwipeDown: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        console.log('down?');
        var move = Explorer.walker.move(sre.EventUtil.KeyCode.DOWN);
        if (move === null) return;
        if (move) {
          console.log('updating');
          console.log(Explorer.walker.speech());          
          Explorer.liveRegion.Update(Explorer.walker.speech());
          Explorer.Highlight();
        } else {
          Explorer.PlayEarcon();
        }
        FALSE(event);
        return;
       } else {
        console.log("Walker Not activated");
       }
    },

    Keydown: function(event) {
      if (event.keyCode === KEY.ESCAPE) {
        if (!Explorer.walker) return;
        Explorer.DeactivateWalker();
        FALSE(event);
        return;
      }
      // If walker is active we redirect there.
      if (Explorer.walker && Explorer.walker.isActive()) {
        var move = Explorer.walker.move(event.keyCode);
        console.log(event.keyCode);
        if (move === null) return;
        if (move) {
          Explorer.liveRegion.Update(Explorer.walker.speech());
          Explorer.Highlight();
        } else {
          Explorer.PlayEarcon();
        }
        FALSE(event);
        return;
      }
      var math = event.target;
      if (event.keyCode === KEY.SPACE) {
        if (event.shiftKey) {
          Explorer.ActivateWalker(math);
        } else {
          MathJax.Extension.MathEvents.Event.ContextMenu(event, math);
        }
        FALSE(event);
        return;
      }
    },
    GetHighlighter: function(alpha) {
      Explorer.highlighter = sre.HighlighterFactory.highlighter(
        {color: Assistive.getOption('background'), alpha: alpha},
        {color: Assistive.getOption('foreground'), alpha: 1},
        {renderer: MathJax.Hub.outputJax['jax/mml'][0].id,
         browser: MathJax.Hub.Browser.name}
      );
    },
    //
    // Adds touch event to action items in an enriched jax.
    //
    
    
    AddTouchEvents: function(node) {
      sre.HighlighterFactory.addEvents(
        node,
        {'touchstart': Explorer.TouchStart,
         'touchend': Explorer.TouchEnd,
         'touchmove': Explorer.TouchMove},
        {renderer: MathJax.Hub.outputJax['jax/mml'][0].id,
         browser: MathJax.Hub.Browser.name}
      );
    },
    //TouchStart: function(event){
    //  event.preventDefault();
    //  if (Explorer.hoverer) {
    //    Explorer.highlighter.unhighlight();
    //    Explorer.hoverer = false;
    // }
    //  if (Explorer.config.highlight === 'none') return;
    //  if (Explorer.config.highlight === 'hover') {
    //    var frame = event.currentTarget;
    //   Explorer.GetHighlighter(.1);
    //   Explorer.highlighter.highlight([frame]);
    //    Explorer.hoverer = true;
    //  }
    //  MathJax.Extension.MathEvents.Event.False(event);


    //},
    

    TouchStart: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        event.preventDefault();
      };
    },
    TouchEnd: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        event.preventDefault();
      };
    },
    TouchMove: function(event){
      if (Explorer.walker && Explorer.walker.isActive()) {
        event.preventDefault();
      };
    },

    //
    // Adds mouse events to maction items in an enriched jax.
    //
    AddMouseEvents: function(node) {
      console.log("mouse event triggered");
      sre.HighlighterFactory.addEvents(
        node,
        {'mouseover': Explorer.MouseOver,
         'mouseout': Explorer.MouseOut},
        {renderer: MathJax.Hub.outputJax['jax/mml'][0].id,
         browser: MathJax.Hub.Browser.name}
      );
    },
    MouseOver: function(event) {
      if (Assistive.getOption('highlight') === 'none') return;
      if (Assistive.getOption('highlight') === 'hover') {
        var frame = event.currentTarget;
        Explorer.GetHighlighter(.1);
        Explorer.highlighter.highlight([frame]);
        Explorer.hoverer = true;
      }
      MathJax.Extension.MathEvents.Event.False(event);
    },
    MouseOut: function (event) {
      if (Explorer.hoverer) {
        Explorer.highlighter.unhighlight();
        Explorer.hoverer = false;
      }
      return MathJax.Extension.MathEvents.Event.False(event);
    },
    //
    // Activates Flaming
    //
    Flame: function(node) {
      if (Assistive.getOption('highlight') === 'flame') {
        Explorer.GetHighlighter(.05);
        Explorer.highlighter.highlightAll(node);
        Explorer.flamer = true;
        return;
      }
    },
    UnFlame: function() {
      if (Explorer.flamer) {
        Explorer.highlighter.unhighlightAll();
        Explorer.flamer = null;
      }
    },
    FlameEnriched: function() {
      Explorer.UnFlame();
      for (var i = 0, all = MathJax.Hub.getAllJax(), jax; jax = all[i]; i++) {
        Explorer.Flame(jax.SourceElement().previousSibling);
      }
    },
    // 
    // Activates the walker.
    //
    Walkers: {
      'syntactic': sre.SyntaxWalker,
      'semantic': sre.SemanticWalker,
      'dummy': sre.DummyWalker
    },
    ActivateWalker: function(math) {
      var speechGenerator = new sre.DirectSpeechGenerator();
      var constructor = Explorer.Walkers[Assistive.getOption('walker')] ||
            Explorer.Walkers['dummy'];
      Explorer.walker = new constructor(math, speechGenerator);
      Explorer.GetHighlighter(.2);
      Explorer.walker.activate();
      if (Assistive.getOption('generateSpeech') &&
          Assistive.getOption('speech')) {
        if (Assistive.getOption('subtitle')) {
          Explorer.liveRegion.Show(math, Explorer.highlighter);
        }
        Explorer.liveRegion.Update(Explorer.walker.speech());
      }
      Explorer.Highlight();
    },
    //
    // Deactivates the walker.
    //
    DeactivateWalker: function() {
      Explorer.liveRegion.Clear();
      Explorer.liveRegion.Hide();
      Explorer.Unhighlight();
      Explorer.currentHighlight = null;
      Explorer.walker.deactivate();
      Explorer.walker = null;
    },
    //
    // Highlights the focused nodes.
    //
    Highlight: function() {
      Explorer.Unhighlight();
      Explorer.highlighter.highlight(Explorer.walker.getFocus().getNodes());
    },
    //
    // Unhighlights the old nodes.
    //
    Unhighlight: function() {
      Explorer.highlighter.unhighlight();
    },
    //
    // Plays the earcon.
    //
    // Every time we make new Audio element, as some browsers do not allow to
    // play audio elements more than once (e.g., Safari).
    //
    PlayEarcon: function() {
      var audio = new Audio(Explorer.earconFile);
      audio.play();
    },
    //
    // Regenerates speech.
    //
    Regenerate: function() {
      Explorer.Reset();
      var speechItems = ['SpeechOutput', 'Subtitles'];
      speechItems.forEach(
        function(x) {
          var item = MathJax.Menu.menu.FindId('Accessibility', x);
          if (item) {
            item.disabled = !item.disabled;
          }});
      for (var i = 0, all = MathJax.Hub.getAllJax(), jax; jax = all[i]; i++) {
        if (jax.enriched) {
          MathJax.Hub.Queue(['Reprocess', jax]);
        }
      }
    }
  };

  MathJax.Extension.Assistive.addDefaults();

  MathJax.Hub.Register.StartupHook('MathMenu Ready', function() {
    var ITEM = MathJax.Menu.ITEM;
    var accessibilityMenu =
          ITEM.SUBMENU(['Accessibility', 'Accessibilty'],
              ITEM.SUBMENU(['Walker', 'Walker'],
                  ITEM.RADIO(['dummy', 'No walker'], 'Assistive-walker'),
                  ITEM.RADIO(['syntactic', 'Syntax walker'], 'Assistive-walker'),
                  ITEM.RADIO(['semantic', 'Semantic walker'], 'Assistive-walker')
                          ),
              ITEM.SUBMENU(['Highlight', 'Highlight'],
                           ITEM.RADIO(['none', 'None'], 'Assistive-highlight', {action: Explorer.Reset}),
                           ITEM.RADIO(['hover', 'Hover'], 'Assistive-highlight', {action: Explorer.Reset}),
                           ITEM.RADIO(['flame','Flame'], 'Assistive-highlight', {action: Explorer.Reset})
                          ),
              ITEM.SUBMENU(['Background', 'Background'],
                           ITEM.RADIO(['blue','Blue'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['red','Red'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['green','Green'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['yellow','Yellow'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['cyan','Cyan'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['magenta','Magenta'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['white','White'], 'Assistive-background', {action: Explorer.Reset}),
                           ITEM.RADIO(['black','Black'], 'Assistive-background', {action: Explorer.Reset})
                          ),
              ITEM.SUBMENU(['Foreground', 'Foreground'],
                           ITEM.RADIO(['black','Black'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['white','White'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['magenta','Magenta'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['cyan','Cyan'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['yellow','Yellow'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['green','Green'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['red','Red'], 'Assistive-foreground', {action: Explorer.Reset}),
                           ITEM.RADIO(['blue','Blue'], 'Assistive-foreground', {action: Explorer.Reset})
                          ),
                       ITEM.RULE(),
                       ITEM.CHECKBOX(['GenerateSpeech', 'Generate Speech'], 'Assistive-generateSpeech',
                                     {action: Explorer.Regenerate}),
                       ITEM.CHECKBOX(['SpeechOutput', 'Speech Output'], 'Assistive-speech',
                                     {disabled: !SETTINGS['Assistive-generateSpeech']}),
                       ITEM.CHECKBOX(['Subtitles', 'Subtitles'], 'Assistive-subtitle',
                                     {disabled: !SETTINGS['Assistive-generateSpeech']})
                      );
    // Attaches the menu;
    var about = MathJax.Menu.menu.IndexOfId('About');
    if (about === null) {
      MathJax.Menu.menu.items.push(ITEM.RULE(), accessibilityMenu);
      return;
    }
    MathJax.Menu.menu.items.splice(about, 0, accessibilityMenu, ITEM.RULE());
  });

  MathJax.Hub.Register.MessageHook('New Math', ['Register', MathJax.Extension.Assistive.Explorer]);

  MathJax.Hub.Startup.signal.Post("Explorer Ready");
});

MathJax.Ajax.loadComplete("[RespEq]/Assistive-Explore.js");
