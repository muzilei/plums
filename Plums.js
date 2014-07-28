/***********************************************************************************
|-----------------------------------------------------------------------------------
|--- css选择符查询引擎，支持 css1 ~ css3 的大部分选择器
|-----------------------------------------------------------------------------------
|--- version:Plums 1.0
|--- author:muzilei
|--- website:http://www.muzilei.com/
|--- Email:530624206@qq.com
|--- date:2014-07-16
|-----------------------------------------------------------------------------------
|--- 欢迎您使用，测试代码，及时反馈您的建议或出现的bug
|************************************************************************************
*/
(function(window){
    var 
    //匹配#id、.class、element
    rsimple=/^([#|\.]?)(\w+)$/,
    
    //匹配伪类选择符   
    rpseudo=/^(:)([\w-]+)(\((.+)\))*$/,
        
    //解析属性选择器，将[attrName=attrVal]分解成一个数组
    rattr=/^\[\s*((?:[\w\u00c0-\uFFFF-]*(?:\\.[\w\u00c0-\uFFFF-]*)*))\s*(?:([^\s]?=)\s*('[^'\s\]]*'|"[^"\s\]]*"|[^'"\s\]]*))\s*\]$/,
    
    //匹配伪类中的括号中的值
    rPsedoPar=/:(not|contains|nth-(?:last-)*(?:child|of-type))(\(([^\)]+)\))/g,
        
    //匹配first|last|only|nth-*类型伪类
    rflon=/(^(first|last|only|nth|nth-last)-(of-type|child))/,
        
    //匹配分解伪类中的参数公式,不然 2n/2n+1/even/odd
    rMatchNth=/^([+-]?\d*)?([a-z]+)?([+-]\d+)?$/,
    
    //对简单和组合选择器进行分解的匹配符
    rgroupSign=/\s*(\>|\+|\~|\x20)\s*/g,
    rSimpleSign=/\s*([\#|\.|\[|\:])\s*/g,
    
    //清楚选择符中所有多余空格
    rCleanAllSpace=/(\[\s*[\w\'\'\=\*\$\|\~\^]+\s*\]|(\s*[\+|>|~|,'|\x20]\s*))/g,
 
    //缓存:not(selector) 或contains(selector)中的selector
    cacheNC=[],    
    
    //缓存选择器解析后的key-val对象
    cacheParse={},
        
    //是否有重复元素
    hasDuplicate=false,
    
    doc=document,
        
    //定义Plums对象
    Plums={};
    
    /*************初始化函数，主入口*****************************
    |-参数：selector<css选择符>，context<上下文，默认为document>
    **********************************************************/
    Plums.man=function(selector,context){
        
        //清除所有多余空格
        selector=Plums.tools.clearSpace(selector,rCleanAllSpace);
        
        var r=rPsedoPar.exec(selector),
            i=0,
            result=[],
            group,
            context=context || doc;
        
        //首先过滤掉:not(selector) 或contains(selector)中的selector
        while(r!=null){
            selector=selector.replace(r[2],"(NC_"+i+")");
            cacheNC[i]=r[3];
            i++;
            r=rPsedoPar.exec(selector);
        }
      
        //console.log(selector);
        //console.log(cacheNC);
        //判断输入的是否是最基本的简单选择器，无前后缀符
        var isBaseSel=rsimple.exec(selector);
        
        if(isBaseSel){
            return Q.simple(selector,context,isBaseSel);
        }
        
        //第一步：分解群组选择器
        group=selector.split(/\s*,\s*/);
      
        //遍历group,判断是否是组合选择器，然后分配不同的处理函数
        T.forEach(group,function(item,index){
              item=item.replace("~=","`=");
              item=item.replace("|=","%=");
              
              result=result.concat( Q[rgroupSign.test( item ) ? "group" : "simple"]( item , context) );
        });
       
        //返回经过去重及排序后的结果
        return T.uniqueSort(result);
    };
    
    //分割选择器函数,参数reg为分割符正则表达式 
    Plums.rSplit=function(selector,reg){
         
            var r,ret=[],i=0;
            reg.lastIndexOf=0;
        
            while((r=reg.exec(selector))!=null){
                 ret.push(selector.slice(i==0?i:i+1,r.index));
                 ret.push(r[0]);
                 i=r.index;
            }
          
           return ret.concat(selector.slice(i+1));
    };
    
    //解析选择器函数
    Plums.parse=function(selector){
        //console.log(selector);
        
        var 
        splits=Plums.rSplit(selector,rSimpleSign),
        base=null,
        suffix=null,
        prefix=null;
        
        //如果parse 长度为1，说明是tag类型，则直接返回解析结果
        if(splits.length == 1){ 
            return {
                    base:{
                    fn:"tag",
                    sel:selector
                    },
                    prefix:prefix,
                    suffix:suffix
                };
        }
        
        var
        a=splits[0],
        b=splits[1],
        c=splits[2];
     
        base={
                fn:b.replace(/(#|\.)/,function($1){
                    return $1=="#"?"id":"class"
                }),
                sel:c
                };
        
        //后缀符只有splits长度大于3时才会有
        suffix=splits.length>3 ? splits.slice(3) : null;

        //前缀符可能为空
        prefix=a.length ? {fn:"tag",sel:a}:null;
        
        
        //如果是 elem[attr=val]、elem:pasedo 类型，base就成了属性或伪类，
        //这里需要处理下将base改成第一项，其它的归到后缀中
        if("[:".indexOf(b)>=0){
            base={
                fn:"tag",
                sel:a.length ? a : "*"
            };
            
            suffix=splits.slice(1);
            prefix=null;
        }
       
        //此时suffix是一个数组，需要进一步解析
        if(suffix!=null){
            var ret=[];

            //遍历后缀数组
            for(var i=0,len=suffix.length;i<len-1;i=i+2){
                
                var fh=suffix[i],
                    sel=suffix[i+1],
                    selParse=fh=="[" ? rattr.exec("["+sel) :
                        fh==":" ? rpseudo.exec(":"+sel) : sel;
                
                if(!selParse){
                    selParse=sel.replace("]","");
                }

                //替换first-*和last-*为nth-*
                if(rflon.test(selParse[2])){
                    selParse[2]=selParse[2].replace(/^first-/,"nth-");
                    selParse[2]=selParse[2].replace(/^last-/,"nth-last-");
                    selParse[4]="1";
                }

                //根据分隔符，分配对应的过滤函数
                ret.push({
                    fn:fh.replace(/(#|\.|:|\[)/,function($1){
                        switch($1){
                            case "#":
                                return "id";
                                break;
                            case ".":
                                return "className";
                                break;
                            case "[":
                                return "attr";
                                break;
                            case ":":
                                return "pasedo";
                                break;
                            default:
                                return "tag";
                        }
                        }),
                    sel:selParse
                });
            }
            
            suffix=ret;
         }
        
        return {
                base:base,
                prefix:prefix,
                suffix:suffix
            };
    };
    
    //查询入口函数
    Plums.query=Q={
        //处理简单选择器
        simple:function(selector,context,isBaseSel){
            //如果是基本简单选择器，先进行处理，无需解析
            var isBaseSel=isBaseSel || rsimple.exec(selector);
            
            if(isBaseSel && T.isArray(isBaseSel)){
                switch(isBaseSel[1]){
                    case "#":
                        return $.$id(isBaseSel[2],context);
                        break;
                    case ".":
                        return $.$class(isBaseSel[2],context);
                        break;
                    default:
                        return $.$tag(isBaseSel[2],context);
                }
            }
          
            //解析选择器，生成键值对对象
            var ret=[],
                parsed=Plums.parse(selector);
            
            //console.log(parsed);
            
            //缓存解析结果
            cacheParse=parsed;
            
            //开始查询
            ret=ret.concat($["$"+parsed.base.fn](parsed.base.sel,context));
            
            //如果有前缀、后缀则进行过滤
            if(ret.length && (parsed.prefix || parsed.suffix)){
                ret=Plums.checkFix(ret,parsed);
            }
            
            return ret;
        },
        //处理组合选择器
        group:function(selector,context){
            rgroupSign.lastIndex=0;
            
            var ret=[],
                splits=Plums.rSplit(selector,rgroupSign),
                fn={
                     //elem elem1 后代选择器
                     "\x20":function(seed,sel){
                         var temp=[];
                        
                        for(var i=0,len=seed.length;i<len;i++){
                            temp=temp.concat(Q.simple(sel,seed[i]));
                        }
                         
                        return temp;
                     },
                     //elem > elem1 子选择器
                     ">":function(seed,sel){
                         var temp=[],
                             //seedNode=T.isArray(seed) ? seed : T.makeArray(seed),
                             selNode=Q.simple(sel,context);

                         for(var i=0,len=selNode.length;i<len;i++){
                            var parnode=selNode[i].parentNode,
                                check=T.indexOf(seed,parnode);

                            if(check>=0){
                                temp.push(selNode[i]);
                            }
                         }

                         return temp;
                     },
                     //elem + elem1 兄弟选择器
                     "+":function(seed,sel){

                         //处理sel不是#id的情况 
                          var selSmart=Plums.parse(sel),
                          temp=[];

                         for(var i=0,len=seed.length;i<len;i++){
                             var nexts=$.$nextSibling(seed[i]),
                                 check=F.isType(nexts ,selSmart);

                             if(check){
                                temp.push(nexts);
                             }
                          }

                         return temp;
                     },
                     //elem ~ elem1 之后所有兄弟选择器
                     "~":function(seed,sel){
                         
                         var temp=[],
                             currParNode=[],
                             selSmart=Plums.parse(sel);
   
                         for(var i=0,len=seed.length;i<len;i++){
                            var parnode=seed[i].parentNode,
                                siball=parnode.childNodes; 

                             //如果当前父节点已在之前搜索过跳过此次循环
                             if(currParNode.indexOf(parnode) >= 0){
                                continue;
                             }else{
                                currParNode.push(seed[i].parentNode);
                             }

                             for(var j=0,lens=siball.length;j<lens;j++){
                                if(T.compareDocumentPosition(seed[i],siball[j]) == 4 && F.isType(siball[j],selSmart)){
                                    temp.push(siball[j]);
                                }
                             }
                         }

                         return temp;
                     }
                 };

         //从左至右分解执行对应函数
         for(var len=splits.length,i=0;i<len-1;i=i+2){
            var a=splits[i],
                b=splits[i+1].replace(/\s+/,"\x20"),
                c=splits[i+2];
                 
                //console.log(a);
                //console.log(b);
                //console.log(c);
                
                ret=i==0 ? Q.simple(a,context) : ret;
             
                //执行对应函数
                ret=fn[b](ret,c,false);
         }
 
         return ret;
        }
    };
    
    //根据前缀和后缀的属性分配对应的过滤函数
    Plums.checkFix=function(arr,parsed){
          var prefix=parsed.prefix,
              suffix=parsed.suffix,
              parentArr=[],
              cacheNth=[],
              result=[];
          
          //遍历节点，进行过滤
          T.forEach(arr,function(node,index,arr){
              var prefix_pass=false;
              
              //首先判断前缀符，如果通过再判断后缀，否则停止
              if(prefix){
                var fn=prefix.fn,
                    sel=prefix.sel;
                  
                    prefix_pass=F[fn](node,sel) ? true : false;
                  
              }else{
                prefix_pass=true;
              }
              
              //判断后缀
              if(suffix && prefix_pass){
                  var temp;
                  
                  //后缀是数组，需遍历每个进行过滤
                  for(var i=0,len=suffix.length;i<len;i++){
                      var fn=suffix[i].fn,
                          sel=suffix[i].sel;
                        
                        //如果是nth-*类型，解析公式，添加序号属性
                        if(rflon.test(sel[2])){
                            var parent=node.parentNode,
                                cnthIndex=T.indexOf(parentArr,parent);
                            
                            //如果具有相同父节点，只需解析一次公式
                            if(cnthIndex < 0){
                                parentArr.push(parent);
                                
                                //解析公式
                                cacheNth.push(Plums.parseNth(sel,parent));
                                cnthIndex=cacheNth.length - 1;
                            }
                            
                            //将解析的结果保存在sel[5]中
                            sel[5]=cacheNth[cnthIndex];
                        }
                        
                        node=F[fn](node,sel);

                        //如果返回结果为false或undefined 提前结束循环
                        if(!node){
                            break;
                        }
                  }
                  
                  if(node != null){
                    result.push(node);
                  }
                
              }
              //前缀检测返回true ，后缀为null时
              else if(!suffix && prefix_pass){
                  result.push(node);
              }
          });
        
        return result;
        
    };
    
    /***********************************************************************************************
    |--- 函数Plums.parseNth，对伪类中出现的公式进行解析
    |--- 此函数会返回解析后所以要查找的节点序号，及同级节点数量
         其中在处理nth-*类型使用了通过对节点添加序号属性提高查询速度的方法
    |***********************************************************************************************
    */    
    Plums.parseNth=function(formula,parNode){
        
                var par=formula[3]==undefined?formula[4]:cacheNC[formula[3].split("_")[1].replace(")","")],
                    parsed = par.match(rMatchNth),
                    isOfType=formula[2].indexOf("of-type"),
                    isLastType=formula[2].indexOf("last-");
                  
                if (!parsed){ return false; }

                var special = parsed[2] || false,
                    a = parsed[1] || 1,
                    b = +parsed[3] || 0;

                if (a == '-'){a = -1;}

                parsed =
                    (special == 'n')	? {a: a, b: b} :
                    (special == 'odd')	? {a: 2, b: 1} :
                    (special == 'even')	? {a: 2, b: 0} : 
                    {a: 0, b: a};

                //计算公式
                var i=0,
                    childs=$.$childNodes(parNode),
                    clens=childs.length,
                    num=[];
                
                //如果是*-of-type类型过滤childs
                if(isOfType >= 0 ){
                    var ofTypeChilds=[];
                   
                    T.forEach(childs,function(node){
                        if(F.isType(node,cacheParse)){
                            ofTypeChilds.push(node);
                        }
                    });
                    
                    childs = ofTypeChilds;
                    clens = ofTypeChilds.length;
                }
 
                 while(i<clens){
                      if(parsed.a == 0){
                            num=[parsed.b];
                          
                        }else{
                            var v=parsed.a * i + parseInt(parsed.b);
                      
                            if(v<=clens){
                                num.push(v);
                            } 
                        }
                        
                        //给节点添加序列属性，以便查询
                        childs[i].setAttribute(isOfType >= 0 ? "_oi" : "_i",i+1);
                        
                        i++;
                    }
                
                //console.log(num);
        
                return {
                        par:par,
                        numStr:","+num.join(",")+",",
                        clens:clens
                        };
                };
    
    //查找节点函数
    Plums.find=$={
        //根据id获取节点
        $id:function(id,context){
            var r=doc.getElementById(id);
            return r ? [r] : [];
        },
        //根据类名获取节点
        $class:doc.getElementsByClassName ?
                function(className,context){
                    var r=context.getElementsByClassName(className);
                    return r ? T.makeArray(r) : [];
                }:
                function(className,context){
                    var all=$.$tag("*",context),
                        r=[],
                        i=0,
                        len=all.length;
                    
                    while(i<len){
                        if(F.className(all[i],className)){
                            r.push(all[i]);
                        }
                        
                        i++;
                    }
                    
                    return r;
                }
        ,
        //根据标签名称获取节点
        $tag:function(tagName,context){
            var r=context.getElementsByTagName(tagName);
            return r ? T.makeArray(r) : [];
        },
        //获取一个节点的最近的所有子节点
        $childNodes:function(node){
             var n=node.firstChild,
                 ret=[];
    
             while(n){
               if(n.nodeType == 1){
                   ret.push(n);
               }
                n=n.nextSibling;
             }
            
            return ret;
        },
        //获取兄弟节点
        $nextSibling:function(node){
            var n=node.nextSibling;
        
            while(n){
                if(n.nodeType == 1){
                    return n;
                }
                n=n.nextSibling;
            }
            
            return null;
        }
    };
    
    //过滤函数
    Plums.filte=F={
        //检测是否有指定的classname
        className:function(node,claName){
            var reg = new RegExp("(^|\\s)" + claName + "(\\s|$)");
            return reg.test(node.className);
        },
        id:function(node,id){
            return node && node.nodeType == 1 && T.trim(node.id) == id ? true : false; 
        },
        tag:function(node,tagName){
            return node && node.nodeType == 1 && node.tagName.toLocaleLowerCase() == tagName ? true : false;
        },
        attr:function(node,attr){
            
             //匹配属性符
            var attrName=T.isArray(attr) ? attr[1] : attr,
                nodeAttrVal=attrName == "class" ? node.className : (node[attrName] || node.getAttribute(attrName)),
                val=T.isArray(attr) ? T.trim(attr[3].replace(/'/g,"")) : "",
                ret;
            
            if(!nodeAttrVal){
                return null;
            }
           
            //比较属性和属性值
            switch(attr[2]){
                    case "=":
                        ret = val == nodeAttrVal;
                        break;
                    case "!=":
                        ret = val != nodeAttrVal;
                        break;
                    case "^=":
                        ret = val && nodeAttrVal.indexOf(val) == 0;
                        break;
                    case "$=":
                        ret = val && nodeAttrVal.slice(-val.length) === val;
                        break;
                    case "*=":
                        ret = val && nodeAttrVal.indexOf(val) > -1;
                        break;
                    case "`=":
                        ret = (" " + nodeAttrVal + " ").indexOf(" "+val+" ") > -1;
                        break;
                    case "%=":
                        ret = nodeAttrVal === val || nodeAttrVal.slice( 0, val.length + 1 ) === val + "-";
                        break;
                    default:
                        ret = nodeAttrVal;
            }
            
            return ret ? node : null;
        },
        pasedo:function(node,pasedo){
            
             if(pasedo[5] && pasedo[5].par=="n"){
                return node;
             }
            
            var a=pasedo[2],
                b=pasedo[3],
                c=b ? cacheNC[b.split("_")[1].replace(")","")] : pasedo[4],
                //比较函数
                comp=function(ntype,t){
                    var parse=pasedo[5],
                        index=parse.numStr,
                        clens=parse.clens,
                        i=node[ntype] || node.getAttribute(ntype),
                        nodeIndex="," + ( (t == "nth-of-type" || t == "nth-child") ? i : clens - i + 1) +",";
                       
                        return index.indexOf(nodeIndex) >=0 ? node : null;
                };
            
            switch(a){
                case "empty":
                    var sib=node.childNodes;
                    return sib.length ? null : node;
                    break;
                case "lang":
                    var val=node["lang"] || node.getAttribute("lang");
                    return val && ( T.trim(val) == pasedo[4] || T.trim(val).indexOf((pasedo[4]+"-")) == 0) ? node : null;
                    break;
                case "not":
                    //console.log(Plums.parse(c));
                    return F.isType(node,Plums.parse(c))? null : node;
                    break;
                case "contains":
                    return node.innerHTML.indexOf(c) >= 0 ? node : null;
                    break;
                    
                case "checked":
                    var val=node.getAttribute("checked");
                    return val && val=="checked" ? node : null;
                    break;
                case "disabled":
                    var val=node.getAttribute("disabled");
                    return val && val=="disabled" ? node : null;
                    break;
                case "enabled":
                    var val=node.getAttribute("disabled"),
                        val2=node.getAttribute("enabled");
                    
                    return (val2 && val2=="enabled") || (!val) ? node : null;
                    break;
                case "selected":
                    var val=node.getAttribute("selected");
                    return val && val=="selected" ? node : null;
                    break;
                    
                case "nth-of-type":
                case "nth-last-of-type":
                    return comp("_oi",a);
                    break; 
                    
                case "nth-child":
                case "nth-last-child":
                     return comp("_i",a);
                    break;
                    
                case "only-of-type":
                case "only-child":
                    var ntype=a == "only-child" ? "_i" : "_oi",
                        i=node[ntype] || node.getAttribute(ntype);
                    return pasedo[5].clens == 1 && i == 1 ? node : null;
                    break;
            }
             
            return undefined;
        },
        //判断节点是否和当前节点类型规则一样
        isType:function(node,smart){
            var a,b,c,_self=this;
             
                a=F[smart.base.fn == "class" ? smart.base.fn + "Name" : smart.base.fn](node,smart.base.sel);
                b=smart.prefix ? _self[smart.prefix.fn](node,smart.prefix.sel) : true;
                c=smart.suffix ? function(){
                                        var temp=[];
                                        for(var i=0,len=smart.suffix.length;i<len;i++){
                                            var fn=smart.suffix[i].fn,
                                                sel=smart.suffix[i].sel;

                                            if(fn=="pasedo"){
                                                temp.push(true);
                                                break;
                                            }

                                            if(fn=="attr"){
                                                temp.push(_self[fn](node,sel));
                                            }
                                        }

                                        return temp.join(',').indexOf("false")>=0 ? false : true;

                                        }() : true;

                //console.log(a);
                //console.log(b);
                //console.log(c);

                return a && b && c ? true : false;
        }
    };
    
    //工具函数
    Plums.tools=T={
        //遍历数组，为每个元素执行回调函数，并将当前元素、当前元素所以及数组对象作为会调函数的参数
        forEach:function(array,callback){
               if(Array.prototype.forEach ){
                    array.forEach(callback);
               }else{
                    for(var i=0,len=array.length;i<len;i++){
                        callback(array[i],i,array);
                    }
               } 
        },
        //对数组去重并排序
        uniqueSort:function(arr){
             var elem,
                 duplicates = [],
                 j = 0,
                 i = 0,
                 _self=this;

             //首先对数组按节点的位置从前到后排序
             arr.sort(function(a,b){
                 if(a===b){
                    hasDuplicate=true;//有重复元素
                 }
                 var comp=_self.compareDocumentPosition(a,b);

                 if(comp==4 || comp==20){
                    return -1;
                 }else if(comp==2 || comp==10){
                    return 1;
                 }else{
                    return 0;
                 }
             });

             //去重
             if(hasDuplicate){
                while ((elem = arr[i++])){
                    if (elem === arr[i]){
                        j = duplicates.push(i);
                    }
                }
                while (j--){
                    arr.splice(duplicates[j],1);
                }
                hasDuplicate=false;
             }
             return arr;
            },
        
        //将nodelist转成数组
        makeArray:function(nodeList){
            try{
                 return [].slice.call(nodeList);
                }catch(e){
                    var j, i=0, rs=[];
                    while(j=nodeList[i])
                        rs[i++] = j;
                    return rs;             
                }  
        },
        
        //类型判断
        isArray:function(o){
            return (typeof o=='object') && o.constructor==Array;
        },
        isString:function(o){
            return (typeof o=='string') && o.constructor==String;
        },
        isObject:function(o){
            return (typeof o=='object') && o.constructor==Object;
        },
        isNumber:function(o){
            return (typeof o=='number') && o.constructor==Number;
        },
        isDate:function(o){
            return (typeof o=='object') && o.constructor==Date;
        },
        isFunction:function(o){
            return (typeof o=='function') && o.constructor==Function;
        },
        isBoolean:function(o){
            return (typeof o=='boolean') && o.constructor==Boolean;
        },
        
        //比较2个节点位置关系
        compareDocumentPosition:function(a,b){
            return a.compareDocumentPosition?
                   a.compareDocumentPosition(b):
                   a.contains?
                   (a!=b && a.contains(b) && 16) +
                   (a!=b && b.contains(a) && 8) +
                   (a.sourceIndex >= 0 && b.sourceIndex >= 0 ?
                   (a.sourceIndex < b.sourceIndex && 4) +
                   (a.sourceIndex > b.sourceIndex && 2):1):0;
        },
        
        //查找b在a中的位置返回
        indexOf:function(a,b){
            var i=a.length-1;
            
            while(i>0){
                if(a[i] === b){
                    return i;
                }
                
                i--;
            }
            
            return -1;
        },
        
        //去重字符串左右空格
        trim:function(str){
            return str.replace(/^\s+|\s+$/,"");
        },
        
        //去掉字符串中所有的多余空格
        clearSpace:function(selector,regular){
            return selector.replace(regular,function($1){
                        var isSp=/\s+[^\x20]\s+/.test($1);
                        return $1.replace(/\s{1,}/g,isSp ? '' : '\x20');
                    })
        }
    };
 
   
    //输出plums对象
    window.Plums=window.P=function(selector,context){
            return Plums.man(selector,context);
    };
 
})(window);
