var http = require('http');
var path = require('path');
var fs = require('fs');

var encode = require('urlencode');

var search = require('node-bing-api')({ accKey: "" }); //Put account key here

var express = require('express');
var cluster = require('express-cluster');

var cookieParser = require('cookie-parser');

var request = require("request");

var S = require('string');

var output;

var math = require('mathjs');

var googleTrends = require('google-trends-api');

//var util = require('util');

cluster(function(worker) {
  var router = express();
  var server = http.createServer(router);
  
  var urlmodule = require('url');
  
  router.use(cookieParser());
  
  var helmet = require('helmet');
  router.use(helmet());
  
  var Globals = {
      'smart'       : '',
      'results'     : '',
      'suggestions' : ''
  };
  
  module.exports = Globals;
  
  router.set('views',__dirname + '/client');
  router.set('view engine', 'ejs');
  router.engine('html', require('ejs').renderFile);
  http.globalAgent.maxSockets = Infinity;
  
  router.set('view cache', true);
  
  router.use(express.static(path.resolve(__dirname, 'client')));
  
  var compression = require('compression');
  router.use(compression());
  
  var expresslru = require('express-lru');
  var cache = expresslru({
      max: 1000,
      ttl: 60000,
      skip: function(req) {
          return !!req.user;
      }
  });
  
  router.get('/news', cache, function (req, res) {
    res.render('news-home.html');
    res.end();
  });
  
  router.get('/', cache, function (req, res) {
    res.render('home.html');
    res.end();
  });
  
  router.get('/about', cache, function (req, res) {
    res.render('about.html');
    res.end();
  });
  
  
  //Redirect
  
  var urlencode = function (str) {
    str = (str + '')
      .toString();

    return encode(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .
    replace(/\)/g, '%29')
      .replace(/\*/g, '%2A')
      .replace(/%20/g, '+');
  };
  
 var urldecode = function (str) {
  return encode.decode((str + '')
    .replace(/%(?![\da-f]{2})/gi, function () {
      return '%25';
    })
    .replace(/\+/g, '%20'));
};
  
  router.get('/redirect', cache, function (req, res) { //LOOK MA! No Tracking!
    var url = urldecode(req.query.url);
    if (urlmodule.format(url).href == undefined) {
      if (url.slice(0,5) == "https") {
        url = url.replace("https//", "https://");
      } else if (url.slice(0,4) == "http") {
        url = url.replace("http//", "http://");
      } else {
        url = "http://" + url; //It should probebly be https but I want all urls to work 
      }
    }
    res.redirect(url);
  });
  
  //End of Redirect
  
  //Web Search
  
  router.get('/search/:term', cache, function (req, res) {
    var term = req.params.term.replace("<","&lt;").replace(">","&gt;").replace("&","&amp;");
    var times;
    var adult = "Off";
    
    if (req.query.times) {
      times = Number(req.query.times);
    } else {
      times = 0;
    }
    
    if (req.cookies.safe == "true") {
      adult = "Strict";
    }
    
    search.web(urldecode(term), {
        top: 10,
        skip: times,
        market: 'en-US',
        adult: adult
      }, function(error, response, body){
        Globals.smart = body.webPages.value[0].displayUrl;
        Globals.results = body.webPages;
        var text = "";
        for (var i = 0; i < body.webPages.value.length; i++) {
            if (req.cookies.safe=="true" && cleanUp(body.webPages.value[i].name)!=body.webPages.value[i].name){ } 
            else {
              text += '<li><div class="collapsible-header">' + body.webPages.value[i].name + '<a href="' + "https://cosmic-search-universe-cosmicwebservices.c9users.io/redirect/?url=" + urlencode(body.webPages.value[i].url) + '" class="btn-small right" target="_blank">visit</a></div><div class="collapsible-body"><p class="flow-text">' + body.webPages.value[i].snippet + '<br><br>' + String(urldecode(body.webPages.value[i].displayUrl).replace("http://","")).replace("https://","") + '<div class="a2a_kit a2a_kit_size_32 a2a_default_style"><a class="a2a_dd" href="https://www.addtoany.com/share"></a><a class="a2a_button_facebook"></a><a class="a2a_button_twitter"></a><a class="a2a_button_google_plus"></a></div><script>var a2a_config=a2a_config ||{};a2a_config.linkurl = "' + body.webPages.value[i].displayUrl + '";a2a_config.onclick=1;</script><script async src="https://static.addtoany.com/menu/page.js"></script></p></div></li>';
            }
        }
        
        if (error) {
          console.log("Whoops there was a problem!");
        }
        else {
          request("https://cosmic-search-universe-cosmicwebservices.c9users.io/apis/math/?eq=" + urlencode(term), function(error2, response, answer) {
            if (!S(String(answer)).contains('error')) {
              res.send(fs.readFileSync("client/search.html")
                .toString()
                .replace('{{smart}}','<p id="smart" class="flow-text">' + term + " = " + answer + '</p>')
                .replace('{{results}}',text));
              
              res.end();
            } else {
              res.send(fs.readFileSync("client/search.html")
                .toString()
                .replace('{{smart}}','<a id="smart" href="' + Globals.smart + '" data-iframely-url></a>')
                .replace('{{results}}',text));
              
              res.end();
            }
          });
        }
    });
  });
  
  router.get('/search', cache, function (req, res) {
    res.redirect('/');
  });
  
  //End Web Search
  
  //News Search
  
  router.get('/news/:term', cache, function (req, res) {
    var times;
    var adult = "Off";
    
    if (req.cookies.safe == "true") {
      adult = "Strict";
    }
    
    if (req.query.times) {
      times = Number(req.query.times);
    } else {
      times = 0;
    }
    
    search.news(urldecode(req.params.term.replace("<","&lt;").replace(">","&gt;").replace("&","&amp;")), {
        top: 10,
        skip: times,
        market: 'en-US',
        adult: adult
      }, function(error, response, body){
        Globals.smart = body.value[0].url;
        Globals.results = body;
        var text = "";
        for (var i = 0; i < body.value.length; i++) {
            if (req.cookies.safe=="true" && cleanUp(body.value[i].name)!=body.value[i].name){ } 
            else {
              text += '<li><div class="collapsible-header">' + body.value[i].name + '<a href="' + "https://cosmic-search-universe-cosmicwebservices.c9users.io/redirect/?url=" + urlencode(body.value[i].url) + '" class="btn-small right" target="_blank">visit</a></div><div class="collapsible-body"><p class="flow-text">' + body.value[i].description + '<br>' + urldecode(body.value[i].url) + '<div class="a2a_kit a2a_kit_size_32 a2a_default_style"><a class="a2a_dd" href="https://www.addtoany.com/share"></a><a class="a2a_button_facebook"></a><a class="a2a_button_twitter"></a><a class="a2a_button_google_plus"></a></div><script>var a2a_config=a2a_config ||{};a2a_config.linkurl = "' + body.value[i].url + '";a2a_config.onclick=1;</script><script async src="https://static.addtoany.com/menu/page.js"></script></p></div></li>';
            }
        }
        text = text.replace(/((http|https|ftp):\/\/[\w?=&.\/-;#~%-]+(?![\w\s?&.\/;#~%"=-]*>))/g, '<a href="$1" target="_blank">$1</a> ');
        if (error) {
          console.log("Whoops there was a problem!");
        }
        else {
          res.send(fs.readFileSync("client/news.html")
            .toString()
            .replace('{{smart}}','<a id="smart" href="' + Globals.smart + '" data-iframely-url></a>')
            .replace('{{results}}',text));
          //Todo remove iframely if website does not work.
          res.end();
        }
    });
  });
  
  //End News Search
  
  //APIs
  
  router.get('/apis/math/', cache, function (req, res) {
    if (req.query.type) {
      if (req.query.type == "text") {
        output = math.eval(encode.decode(req.query.eq));
        res.send(String(output));
      }
      if (req.query.type == "json") {
        output = math.eval(encode.decode(req.query.eq));
        res.send('{\"output\" : \"' + String(output) + '\"}');
      }
    } else {
      output = math.eval(encode.decode(req.query.eq));
      res.send(String(output));
    }
  });
  
  router.get('/apis/suggest/', cache, function (req, res) {
    console.log(encode.decode(req.query.q));
    if (req.query.type) {
      if (req.query.type == "text") {
        googleTrends.relatedQueries({keyword: encode.decode(req.query.q)})
          .then((out) => {
            res.send(String(out));
          })
          .catch((err) => {
            res.send(String(err));
          });
      }
      if (req.query.type == "json") {
        googleTrends.relatedQueries({keyword: encode.decode(req.query.q)})
          .then((out) => {
            res.send('{\"output\" : \"' + String(out) + '\"}');
          })
          .catch((err) => {
            res.send('{\"output\" : \"' + String(err) + '\"}');
          });
      }
    } else {
      googleTrends.relatedQueries({keyword: encode.decode(req.query.q)})
          .then((out) => {
            res.send(String(out));
          })
          .catch((err) => {
            res.send(String(err));
          });
    }
  });
  
  //End of APIs
  
  //Test
  
  router.get('/test', cache, function (req, res) {
    res.send('Cookies: '+ JSON.stringify());
  });
  
  //End of test
  
  router.get('*', cache, function (req, res) {
    res.send(fs.readFileSync("client/error.html")
      .toString()
      .replace('{{error}}', "404")
      .replace('{{link}}', "https://cosmic-search-universe-cosmicwebservices.c9users.io/search/404%20error"));
    res.end();
  });
  
  router.use(function(error, req, res, next) {
   res.send(fs.readFileSync("client/error.html")
      .toString()
      .replace('{{error}}', "500")
      .replace('{{link}}', "https://cosmic-search-universe-cosmicwebservices.c9users.io/search/500%20error"));
    res.end();
  });
  
  server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
    var addr = server.address();
    console.log("Server listening at", addr.address + ":" + addr.port);
  });
  
  
  
  //Bad Word Checking
  
  function rot13(s) {
  return s.replace(/[a-zA-Z]/g,function(c){return String.fromCharCode((c<="Z"?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26);});
  }
  var badwords = ["fuvg","qvpx","qvpxf","qvpxfhpxre","2t1p","2 tveyf 1 phc","npebgbzbcuvyvn","nynonzn ubg cbpxrg","nynfxna cvcryvar","nany","navyvathf","nahf","ncrfuvg","nefrubyr","nff","nffubyr","nffzhapu","nhgb rebgvp","nhgbrebgvp","onorynaq","onol onggre","onol whvpr","onyy tnt","onyy tenil","onyy xvpxvat","onyy yvpxvat","onyy fnpx","onyy fhpxvat","onatoebf","oneronpx","oneryl yrtny","oneranxrq","onfgneq","onfgneqb","onfgvanqb","ooj","oqfz","ornare","ornaref","ornire pyrnire","ornire yvcf","orfgvnyvgl","ovt oynpx","ovt oernfgf","ovt xabpxref","ovt gvgf","ovzobf","oveqybpx","ovgpu","ovgpurf","oynpx pbpx","oybaqr npgvba","oybaqr ba oybaqr npgvba","oybjwbo","oybj wbo","oybj lbhe ybnq","oyhr jnssyr","oyhzcxva","obyybpxf","obaqntr","obare","obbo","obbof","obbgl pnyy","oebja fubjref","oeharggr npgvba","ohxxnxr","ohyyqlxr","ohyyrg ivor","ohyyfuvg","ohat ubyr","ohatubyr","ohfgl","ohgg","ohggpurrxf","ohggubyr","pnzry gbr","pnztvey","pnzfyhg","pnzjuber","pnecrg zhapure","pnecrgzhapure","pubpbyngr ebfrohqf","pvepyrwrex","pyrirynaq fgrnzre","pyvg","pyvgbevf","pybire pynzcf","pyhfgreshpx","pbpx","pbpxf","pbcebyntavn","pbcebcuvyvn","pbeaubyr","pbba","pbbaf","pernzcvr","phz","phzzvat","phaavyvathf","phag","qnexvr","qngr encr","qngrencr","qrrc guebng","qrrcguebng","qraqebcuvyvn","qvpx","qvyqb","qvatyroreel","qvatyroreevrf","qvegl cvyybjf","qvegl fnapurm","qbttvr fglyr","qbttvrfglyr","qbttl fglyr","qbttlfglyr","qbt fglyr","qbyprgg","qbzvangvba","qbzvangevk","qbzzrf","qbaxrl chapu","qbhoyr qbat","qbhoyr crargengvba","qc npgvba","qel uhzc","qiqn","rng zl nff","rppuv","rwnphyngvba","rebgvp","rebgvfz","rfpbeg","rhahpu","snttbg","srpny","srypu","sryyngvb","srygpu","srznyr fdhvegvat","srzqbz","svttvat","svatreonat","svatrevat","svfgvat","sbbg srgvfu","sbbgwbo","sebggvat","shpx","shpx ohggbaf","shpxva","shpxvat","shpxgneqf","shqtr cnpxre","shqtrcnpxre","shgnanev","tnat onat","tnl frk","travgnyf","tvnag pbpx","tvey ba","tvey ba gbc","tveyf tbar jvyq","tbngpk","tbngfr","tbq qnza","tbxxha","tbyqra fubjre","tbbqcbbc","tbb tvey","tbertnfz","tebcr","tebhc frk","t-fcbg","theb","unaq wbo","unaqwbo","uneq pber","uneqpber","uragnv","ubzbrebgvp","ubaxrl","ubbxre","ubg pney","ubg puvpx","ubj gb xvyy","ubj gb zheqre","uhtr sng","uhzcvat","vaprfg","vagrepbhefr","wnpx bss","wnvy onvg","wnvyonvg","wryyl qbahg","wrex bss","wvtnobb","wvttnobb","wvttreobb","wvmm","whttf","xvxr","xvaonxh","xvaxfgre","xvaxl","xaboovat","yrngure erfgenvag","yrngure fgenvtug wnpxrg","yrzba cnegl","ybyvgn","ybirznxvat","znxr zr pbzr","znyr fdhvegvat","znfgheongr","zrantr n gebvf","zvys","zvffvbanel cbfvgvba","zbgureshpxre","zbhaq bs irahf","ze unaqf","zhss qvire","zhssqvivat","anzoyn","anjnfuv","arteb","arbanmv","avttn","avttre","avt abt","avzcubznavn","avccyr","avccyrf","afsj vzntrf","ahqr","ahqvgl","alzcub","alzcubznavn","bpgbchffl","bzbenfuv","bar phc gjb tveyf","bar thl bar wne","betnfz","betl","cnrqbcuvyr","cnxv","cnagvrf","cnagl","crqborne","crqbcuvyr","crttvat","cravf","cubar frk","cvrpr bs fuvg","cvffvat","cvff cvt","cvffcvt","cynlobl","cyrnfher purfg","cbyr fzbxre","cbalcynl","cbbs","cbba","cbbagnat","chanal","cbbc puhgr","cbbcpuhgr","cbea","cbeab","cbeabtencul","cevapr nyoreg cvrepvat","cgup","chorf","chffl","dhrns","dhrrs","dhvz","enturnq","entvat obare","encr","encvat","encvfg","erpghz","erirefr pbjtvey","evzwbo","evzzvat","ebfl cnyz","ebfl cnyz naq ure 5 fvfgref","ehfgl gebzobar","fnqvfz","fnagbehz","fpng","fpuybat","fpvffbevat","frzra","frk","frkb","frkl","funirq ornire","funirq chffl","furznyr","fuvonev","fuvg","fuvgoyvzc","fuvggl","fubgn","fuevzcvat","fxrrg","fynagrlr","fyhg","f&z","fzhg","fangpu","fabjonyyvat","fbqbzvmr","fbqbzl","fcvp","fcybbtr","fcybbtr zbbfr","fcbbtr","fcernq yrtf","fchax","fgenc ba","fgencba","fgenccnqb","fgevc pyho","fglyr qbttl","fhpx","fhpxf","fhvpvqr tveyf","fhygel jbzra","fjnfgvxn","fjvatre","gnvagrq ybir","gnfgr zl","grn onttvat","guerrfbzr","guebngvat","gvrq hc","gvtug juvgr","gvg","gvgf","gvggvrf","gvggl","gbathr va n","gbcyrff","gbffre","gbjryurnq","genaal","gevonqvfz","gho tvey","ghotvey","ghful","gjng","gjvax","gjvaxvr","gjb tveyf bar phc","haqerffvat","hcfxveg","herguen cynl","hebcuvyvn","intvan","irahf zbhaq","ivoengbe","ivbyrg jnaq","ibenercuvyvn","iblrhe","ihyin","jnax","jrgonpx","jrg qernz","juvgr cbjre","jenccvat zra","jevaxyrq fgnesvfu","kk","kkk","lnbv","lryybj fubjref","lvssl","mbbcuvyvn","🖕"].map(rot13);
  function cleanUp(text){
      for(var i = 0; i < badwords.length; i++){
          if(new RegExp(badwords[i], "i").test(text)){
              return Array(text.length+1).join("*");
          }
      }
      return text;
  
  }
  
  //End Bad Word Testing
}, {count: 5});
