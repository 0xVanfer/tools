import{_ as W,G as E,o as u,c as d,a as C,u as L,b as t,v as m,x as y,t as b,F as P,r as T,k as B,e as r,h as F}from"./index-Dgf0mUwk.js";import{_ as M}from"./PageHeader-BcJsB9OO.js";import{C as G}from"./CopyButton-DDSvvkW7.js";const R={class:"vanity-generator"},I={class:"generator-container"},j={class:"card"},$={class:"card-body"},X={class:"input-row"},D=["disabled"],H={class:"input-row"},O=["disabled"],q={class:"input-row"},z=["disabled"],Q={class:"input-row"},J=["disabled"],Y={class:"actions"},Z=["disabled"],ee={key:0,class:"results mt-6"},te={class:"results-header"},se={class:"results-title"},ae={class:"results-list mt-4"},ne={class:"result-row"},le={class:"result-value"},oe={class:"result-row"},re={class:"result-value"},ie={class:"scanned-count"},ue=`
importScripts('https://cdn.jsdelivr.net/npm/ethers@5.7.0/dist/ethers.umd.min.js');

self.onmessage = function(e) {
    const { prefix, suffix } = e.data;
    const prefixLower = prefix ? prefix.toLowerCase() : '';
    const suffixLower = suffix ? suffix.toLowerCase() : '';
    
    let count = 0;
    
    while (true) {
        // Optimization: Generate private key directly to avoid expensive mnemonic derivation
        const privateKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));
        const wallet = new ethers.Wallet(privateKey);
        const address = wallet.address;
        const addressNoPrefix = address.substring(2).toLowerCase();
        
        let match = true;
        if (prefixLower && !addressNoPrefix.startsWith(prefixLower)) match = false;
        if (match && suffixLower && !addressNoPrefix.endsWith(suffixLower)) match = false;
        
        if (match) {
            self.postMessage({
                type: 'found',
                address: wallet.address,
                privateKey: wallet.privateKey
            });
        }
        
        count++;
        if (count >= 10000) {
            self.postMessage({ type: 'progress', count: count });
            count = 0;
        }
    }
};
`,de={__name:"VanityGenerator",setup(ce){const x=r(1),l=r(""),o=r(""),h=r(10),n=r(!1),_=r(0),c=r([]);let w=[],g=0,i=null;const v=/^[0-9a-fA-F]*$/,S=a=>{const s=(a==="prefix"?l.value:o.value).replace(/[^0-9a-fA-F]/g,"");a==="prefix"?l.value=s:o.value=s},V=F(()=>(l.value.length>0||o.value.length>0)&&v.test(l.value)&&v.test(o.value)),K=a=>a.toLocaleString(),A=()=>{if(!v.test(l.value)||!v.test(o.value)){alert("Prefix and Suffix must be valid HEX characters (0-9, A-F)");return}n.value=!0,_.value=0,g=0;const a=navigator.hardwareConcurrency||4,e=new Blob([ue],{type:"application/javascript"}),s=URL.createObjectURL(e);for(let f=0;f<a;f++){const k=new Worker(s);k.onmessage=N,k.postMessage({prefix:l.value,suffix:o.value}),w.push(k)}i&&clearTimeout(i),i=setTimeout(()=>{n.value&&(alert("Timeout reached!"),p())},h.value*60*1e3)},N=a=>{if(!n.value)return;const e=a.data;e.type==="progress"?_.value+=e.count:e.type==="found"&&(c.value.push({address:e.address,privateKey:e.privateKey}),g++,g>=x.value&&p())},p=()=>{i&&(clearTimeout(i),i=null),n.value=!1,w.forEach(a=>a.terminate()),w=[]},U=()=>{c.value=[]};return E(()=>{p()}),(a,e)=>(u(),d("div",R,[C(L(M),{title:"Vanity Address Generator",description:"Generate Ethereum addresses with custom prefixes or suffixes"}),t("div",I,[t("div",j,[t("div",$,[t("div",X,[e[6]||(e[6]=t("label",{class:"label"},"Quantity",-1)),m(t("input",{"onUpdate:modelValue":e[0]||(e[0]=s=>x.value=s),type:"number",class:"input",min:"1",max:"100",disabled:n.value},null,8,D),[[y,x.value,void 0,{number:!0}]])]),t("div",H,[e[7]||(e[7]=t("label",{class:"label"},"Prefix (0x...)",-1)),m(t("input",{"onUpdate:modelValue":e[1]||(e[1]=s=>l.value=s),type:"text",class:"input mono",placeholder:"e.g. AA",disabled:n.value,onInput:e[2]||(e[2]=s=>S("prefix"))},null,40,O),[[y,l.value]])]),t("div",q,[e[8]||(e[8]=t("label",{class:"label"},"Suffix",-1)),m(t("input",{"onUpdate:modelValue":e[3]||(e[3]=s=>o.value=s),type:"text",class:"input mono",placeholder:"e.g. 88",disabled:n.value,onInput:e[4]||(e[4]=s=>S("suffix"))},null,40,z),[[y,o.value]])]),t("div",Q,[e[9]||(e[9]=t("label",{class:"label"},"Timeout (minutes)",-1)),m(t("input",{"onUpdate:modelValue":e[5]||(e[5]=s=>h.value=s),type:"number",class:"input",min:"1",max:"60",disabled:n.value},null,8,J),[[y,h.value,void 0,{number:!0}]])]),t("div",Y,[n.value?(u(),d("button",{key:1,class:"btn btn-danger",onClick:p},"Stop")):(u(),d("button",{key:0,class:"btn btn-primary",onClick:A,disabled:!V.value},"Start Generating",8,Z))])])]),c.value.length>0?(u(),d("div",ee,[t("div",te,[t("h3",se,"Found Addresses ("+b(c.value.length)+")",1),t("button",{class:"btn btn-sm btn-secondary",onClick:U},"Clear Results")]),t("div",ae,[(u(!0),d(P,null,T(c.value,(s,f)=>(u(),d("div",{key:f,class:"result-item"},[t("div",ne,[e[10]||(e[10]=t("span",{class:"result-label"},"Address:",-1)),t("span",le,b(s.address),1),C(L(G),{text:s.address},null,8,["text"])]),t("div",oe,[e[11]||(e[11]=t("span",{class:"result-label"},"Private Key:",-1)),t("span",re,b(s.privateKey),1),C(L(G),{text:s.privateKey},null,8,["text"])])]))),128))])])):B("",!0),e[12]||(e[12]=t("div",{class:"warning-card mt-6"},[t("h4",null,"⚠️ Security Warning"),t("ul",null,[t("li",null,"Private keys are generated locally in your browser"),t("li",null,"Never share your private key with anyone"),t("li",null,"Store private keys in a secure location immediately"),t("li",null,"This tool uses Web Workers for performance - no data leaves your browser")])],-1))]),t("div",ie,"Scanned: "+b(K(_.value)),1)]))}},me=W(de,[["__scopeId","data-v-c517e70b"]]);export{me as default};
