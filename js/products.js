const fallbackProducts=[
  {id:'fallback-1',name:'Turmeric Powder',description:'Pure turmeric powder',image_url:'',product_variants:[{id:'v1',variant_name:'250g',price:120,stock_quantity:10,is_active:true}]},
  {id:'fallback-2',name:'Red Chilli Powder',description:'Fresh chilli powder',image_url:'',product_variants:[{id:'v2',variant_name:'250g',price:140,stock_quantity:10,is_active:true}]},
  {id:'fallback-3',name:'Coriander Powder',description:'Aromatic coriander',image_url:'',product_variants:[{id:'v3',variant_name:'250g',price:100,stock_quantity:10,is_active:true}]}
];
async function loadProducts(){
  const grid=document.getElementById('dynamic-product-grid');
  if(!grid)return;
  try{
    if(!window.supabaseClient)throw new Error('Supabase client is not initialized. Check js/supabase.js and the CDN script.');
    const {data,error}=await supabaseClient.from('products').select('*,product_variants(*)').eq('is_active',true).order('created_at',{ascending:false});
    if(error)throw error;
    const catalog=(data||[]).map(p=>({...p,product_variants:(p.product_variants||[]).map(v=>({...v,name:v.variant_name||v.weight||'Pack',stock:v.stock_quantity??0,active:v.is_active!==false}))}));
    renderProducts(catalog,grid);
  }catch(e){console.error('Supabase product fetch failed:',e);renderProducts(fallbackProducts,grid);}
}
function renderProducts(products,grid){
  grid.innerHTML='';
  products.forEach(p=>{
    const variants=(p.product_variants||p.variants||[]).filter(v=>v.active!==false&&v.is_active!==false);
    if(!variants.length)return;
    const card=document.createElement('article');card.className='product-card';
    const img=p.image_url||p.image||'';
    card.innerHTML=`<img src="${escapeAttr(img)}" alt="${escapeAttr(p.name)}" onerror="this.style.display='none'"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description||'')}</p><div class="variant-buttons"></div><p class="price">₹<span class="price-value">${Number(variants[0]?.price||0)}</span></p><button class="add-button">Add to Cart</button>`;
    const buttons=card.querySelector('.variant-buttons');let chosen=variants[0];
    variants.forEach((v,i)=>{const b=document.createElement('button');const pack=v.name||v.variant_name||v.weight||v.label||'Pack';const stock=v.stock??v.stock_quantity;b.textContent=`${pack}${stock!=null&&stock<=0?' (Out of stock)':''}`;b.disabled=stock!=null&&stock<=0;b.onclick=()=>{chosen=v;card.querySelector('.price-value').textContent=v.price;buttons.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');};if(i===0)b.classList.add('selected');buttons.append(b);});
    card.querySelector('.add-button').onclick=()=>chosen&&addToCart(p.name+' ('+(chosen.name||chosen.variant_name||chosen.weight||'Pack')+')',Number(chosen.price),p.id,chosen.id);
    grid.append(card);
  });
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(s){return escapeHtml(s);}
loadProducts();
