(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { products: [], orders: [], leads: [], view: 'dashboard', variantCounter: 0 };
  const slugify = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const normalizeProduct = p => ({...p, active:p.is_active!==false, product_variants:(p.product_variants||[]).map(v=>({...v,name:v.variant_name||v.weight||'Pack',stock:v.stock_quantity??0,active:v.is_active!==false}))});
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
  let toastTimer;
  function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
  function setMessage(message, success=false) { $('formMessage').textContent=message; $('formMessage').classList.toggle('success',success); }
  function setView(view) {
    state.view=view;
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
    document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    $('pageTitle').textContent=({dashboard:'Dashboard',products:'Products',orders:'Orders',leads:'B2B Enquiries'})[view]||'Dashboard';
    $('sidebar').classList.remove('open');
    if(view==='products') renderProducts();
    if(view==='orders') renderOrders();
    if(view==='leads') renderLeads();
  }
  document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.go)));
  $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  $('topRefresh').addEventListener('click',refreshAll);
  $('quickAdd').addEventListener('click',()=>openProductModal());
  $('addProductBtn').addEventListener('click',()=>openProductModal());
  $('closeModal').addEventListener('click',closeProductModal);
  $('cancelProduct').addEventListener('click',closeProductModal);
  $('productModal').addEventListener('click',e=>{if(e.target===$('productModal'))closeProductModal();});
  $('addVariantBtn').addEventListener('click',()=>addVariantRow());
  $('productSearch').addEventListener('input',renderProducts);

  $('loginForm').addEventListener('submit', async e=>{
    e.preventDefault(); $('loginMsg').textContent='Signing in…';
    let result;try{result=await supabaseClient.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});}catch(err){$('loginMsg').textContent=err.message||'Could not reach Supabase.';return;}
    const {data,error}=result;
    if(error){$('loginMsg').textContent=error.message;return;}
    const {data:admin,error:adminError}=await supabaseClient.from('admin_users').select('user_id,role').eq('user_id',data.user.id).maybeSingle();
    if(adminError||!admin){await supabaseClient.auth.signOut();$('loginMsg').textContent='This account is not authorized as a store admin.';return;}
    await enterApp();
  });
  $('logoutBtn').addEventListener('click',async()=>{await supabaseClient.auth.signOut();location.reload();});

  async function init() {
    if(!window.supabaseClient)throw new Error('Supabase client is unavailable. Check the Supabase CDN and js/supabase.js configuration.');
    const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
    if(sessionError)throw sessionError;
    if(session?.user){const {data:admin}=await supabaseClient.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();if(admin){await enterApp();return;}}
    $('loginView').hidden=false;
  }
  async function enterApp(){ $('loginView').hidden=true; $('appView').hidden=false; await refreshAll(); }
  async function refreshAll(){await Promise.all([loadProducts(),loadOrders(),loadLeads()]);updateStats();renderRecentOrders();if(state.view==='products')renderProducts();if(state.view==='orders')renderOrders();if(state.view==='leads')renderLeads();}
  async function loadProducts(){
    const {data,error}=await supabaseClient.from('products').select('*,product_variants(*)').order('created_at',{ascending:false});
    if(error){$('productsTable').innerHTML=`<div class="empty">${esc(error.message)}</div>`;return;}
    state.products=(data||[]).map(normalizeProduct);
  }
  async function loadOrders(){
    const {data,error}=await supabaseClient.from('orders').select('*').order('created_at',{ascending:false}).limit(150);
    state.orders=error?[]:(data||[]).map(o=>({...o,status:o.order_status||'pending'}));
    if(error)$('ordersTable').innerHTML=`<div class="empty">${esc(error.message)}</div>`;
  }
  async function loadLeads(){
    const {data,error}=await supabaseClient.from('b2b_leads').select('*').order('created_at',{ascending:false}).limit(150);
    state.leads=error?[]:(data||[]);
    if(error)$('leadsTable').innerHTML=`<div class="empty">${esc(error.message)}</div>`;
  }
  function updateStats(){
    $('statProducts').textContent=state.products.length;
    $('statActive').textContent=state.products.filter(p=>p.active).length;
    $('statOrders').textContent=state.orders.length;
    $('statLeads').textContent=state.leads.filter(l=>(l.status||'new')==='new').length;
    $('productCount').textContent=`${state.products.length} products`;
  }
  function productImage(url,name){return url?`<img class="product-thumb" src="${esc(url)}" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;product-thumb placeholder&quot;>✦</span>'">`:`<span class="product-thumb placeholder">✦</span>`;}
  function renderProducts(){
    const q=$('productSearch').value.trim().toLowerCase();
    const products=state.products.filter(p=>[p.name,p.description,...(p.product_variants||[]).map(v=>v.name)].join(' ').toLowerCase().includes(q));
    let rows=[];
    products.forEach(p=>{
      const variants=(p.product_variants||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true}));
      if(!variants.length){rows.push(`<tr><td><div class="product-cell">${productImage(p.image_url,p.name)}<div><span class="product-name">${esc(p.name)}</span><span class="sub-cell">No pack added</span></div></div></td><td>—</td><td>—</td><td class="details-cell">${esc(p.description||'—')}</td><td><span class="status ${p.active?'':'off'}">${p.active?'Active':'Inactive'}</span></td><td><div class="action-group"><button class="small-btn" data-edit="${p.id}">Edit</button><button class="small-btn delete" data-delete="${p.id}">Delete</button></div></td></tr>`);return;}
      variants.forEach((v,i)=>rows.push(`<tr><td><div class="product-cell">${i===0?productImage(p.image_url,p.name):'<span class="product-thumb placeholder">↳</span>'}<div><span class="product-name">${i===0?esc(p.name):'<span class="sub-cell">Same product</span>'}</span>${i===0?`<span class="sub-cell">${esc(p.name)}</span>`:''}</div></div></td><td><strong>${esc(v.name||'Pack')}</strong></td><td><strong>${money(v.price)}</strong></td><td class="details-cell">${i===0?esc(p.description||'—'):'<span class="sub-cell">Product details above</span>'}</td><td><span class="status ${p.active&&v.active?'':'off'}">${p.active&&v.active?'Active':'Inactive'}</span><span class="sub-cell">Stock: ${Number(v.stock||0)}</span></td><td><div class="action-group">${i===0?`<button class="small-btn" data-edit="${p.id}">Edit product</button>`:''}<button class="small-btn" data-edit-variant="${p.id}" data-variant="${v.id}">Edit pack</button><button class="small-btn delete" data-delete-variant="${v.id}" data-product="${p.id}">Delete pack</button>${i===0?`<button class="small-btn delete" data-delete="${p.id}">Delete product</button>`:''}</div></td></tr>`));
    });
    $('productsTable').innerHTML=rows.length?`<table><thead><tr><th>Product name</th><th>Product quantity</th><th>Product price</th><th>Product details</th><th>Status / stock</th><th>Actions</th></tr></thead><tbody>${rows.join('')}</tbody></table>`:'<div class="empty">No products found. Add your first product to get started.</div>';
    $('productsTable').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openProductModal(b.dataset.edit)));
    $('productsTable').querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteProduct(b.dataset.delete)));
    $('productsTable').querySelectorAll('[data-edit-variant]').forEach(b=>b.addEventListener('click',()=>openProductModal(b.dataset.editVariant,b.dataset.variant)));
    $('productsTable').querySelectorAll('[data-delete-variant]').forEach(b=>b.addEventListener('click',()=>deleteVariant(b.dataset.deleteVariant,b.dataset.product)));
  }
  function renderRecentOrders(){
    const list=state.orders.slice(0,5);
    $('recentOrders').innerHTML=list.length?`<table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${list.map(o=>`<tr><td>${esc(o.order_number||String(o.id).slice(0,8))}</td><td>${esc(o.customer_name||'Customer')}</td><td>${money(o.total_amount)}</td><td><span class="status ${o.status==='cancelled'?'off':''}">${esc(o.status||'pending')}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No orders received yet.</div>';
  }
  function renderOrders(){
    $('ordersTable').innerHTML=state.orders.length?`<table><thead><tr><th>Order reference</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Payment</th><th>Order status</th></tr></thead><tbody>${state.orders.map(o=>`<tr><td><strong>${esc(o.order_number||String(o.id).slice(0,8))}</strong><span class="sub-cell">${o.created_at?new Date(o.created_at).toLocaleString('en-IN'):''}</span></td><td>${esc(o.customer_name||'—')}</td><td>${esc(o.customer_phone||'—')}</td><td>${money(o.total_amount)}</td><td>${esc(o.payment_status||'unverified')}</td><td><select class="status-select" data-order="${o.id}">${['pending','confirmed','processing','shipped','completed','cancelled'].map(s=>`<option value="${s}" ${s===(o.status||'pending')?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No orders found.</div>';
    $('ordersTable').querySelectorAll('[data-order]').forEach(s=>s.addEventListener('change',async()=>{const {error}=await supabaseClient.from('orders').update({order_status:s.value}).eq('id',s.dataset.order);if(error){toast(error.message);return;}toast('Order status updated');await loadOrders();updateStats();renderOrders();renderRecentOrders();}));
  }
  function renderLeads(){
    $('leadsTable').innerHTML=state.leads.length?`<table><thead><tr><th>Name</th><th>Business</th><th>Phone</th><th>Email</th><th>Requirements</th><th>Status</th></tr></thead><tbody>${state.leads.map(l=>`<tr><td><strong>${esc(l.name)}</strong></td><td>${esc(l.business_name||'—')}</td><td>${esc(l.phone)}</td><td>${esc(l.email||'—')}</td><td>${esc(l.requirement||'—')}</td><td><select data-lead="${l.id}">${['new','contacted','qualified','closed'].map(s=>`<option value="${s}" ${s===(l.status||'new')?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No B2B enquiries found.</div>';
    $('leadsTable').querySelectorAll('[data-lead]').forEach(s=>s.addEventListener('change',async()=>{const {error}=await supabaseClient.from('b2b_leads').update({status:s.value}).eq('id',s.dataset.lead);if(error){toast(error.message);return;}toast('Enquiry status updated');await loadLeads();updateStats();renderLeads();}));
  }

  function addVariantRow(v={}){
    const key=++state.variantCounter;
    const row=document.createElement('div');row.className='variant-row';row.dataset.variantId=v.id||'';
    row.innerHTML=`<label>Pack size / quantity *<input class="variant-name" required maxlength="40" placeholder="e.g. 250g" value="${esc(v.name||'')}"></label><label>Selling price (₹) *<input class="variant-price" type="number" min="0.01" step="0.01" required placeholder="80" value="${v.price??''}"></label><label>Stock quantity<input class="variant-stock" type="number" min="0" step="1" value="${v.stock??0}"></label><label class="variant-active-label">Status<select class="variant-active"><option value="true" ${v.active!==false?'selected':''}>Active</option><option value="false" ${v.active===false?'selected':''}>Inactive</option></select></label><button type="button" class="remove-variant" aria-label="Remove pack">×</button>`;
    row.querySelector('.remove-variant').addEventListener('click',()=>{if($('variantEditor').children.length===1){toast('At least one pack size is required');return;}row.remove();});
    $('variantEditor').append(row);
  }
  function openProductModal(id=null,focusVariantId=null){
    const p=id?state.products.find(x=>x.id===id):null;
    $('productForm').reset();$('productId').value=p?.id||'';$('productName').value=p?.name||'';$('productDescription').value=p?.description||'';$('productImage').value=p?.image_url||'';$('productActive').checked=p?.active!==false;
    $('variantEditor').innerHTML='';let variants=p?.product_variants||[];
    (variants.length?variants:[{}]).forEach(v=>addVariantRow(v));
    $('modalTitle').textContent=p?(focusVariantId?'Edit pack size':'Edit product'):'Add product';
    $('saveProduct').textContent=p?'Save changes':'Save product';setMessage('');
    $('productModal').hidden=false;document.body.style.overflow='hidden';
    if(focusVariantId){const target=[...$('variantEditor').querySelectorAll('.variant-row')].find(row=>row.dataset.variantId===focusVariantId);target?.scrollIntoView({block:'center'});}
  }
  function closeProductModal(){$('productModal').hidden=true;document.body.style.overflow='';}
  $('productForm').addEventListener('submit',async e=>{
    e.preventDefault();setMessage('');
    const name=$('productName').value.trim();if(!name){setMessage('Product name is required.');return;}
    const rows=[...$('variantEditor').querySelectorAll('.variant-row')];
    if(!rows.length){setMessage('Add at least one pack size and price.');return;}
    const variants=[];
    for(const row of rows){const pack=row.querySelector('.variant-name').value.trim();const price=Number(row.querySelector('.variant-price').value);const stock=Number(row.querySelector('.variant-stock').value||0);if(!pack||!Number.isFinite(price)||price<=0||!Number.isInteger(stock)||stock<0){setMessage('Check each pack size, valid price and stock quantity.');return;}variants.push({id:row.dataset.variantId||null,name:pack,price,stock,active:row.querySelector('.variant-active').value==='true'});}
    $('saveProduct').disabled=true;$('saveProduct').textContent='Saving…';
    try{
      const id=$('productId').value;
      const payload={name,slug:slugify(name),description:$('productDescription').value.trim()||null,image_url:$('productImage').value.trim()||null,is_active:$('productActive').checked,updated_at:new Date().toISOString()};
      const result=id?await supabaseClient.from('products').update(payload).eq('id',id).select().single():await supabaseClient.from('products').insert(payload).select().single();
      if(result.error)throw result.error;
      const product=result.data;
      const current=(state.products.find(p=>p.id===product.id)?.product_variants)||[];
      const keepIds=variants.filter(v=>v.id).map(v=>v.id);
      const removed=current.filter(v=>!keepIds.includes(v.id)).map(v=>v.id);
      if(removed.length){const del=await supabaseClient.from('product_variants').delete().in('id',removed);if(del.error)throw del.error;}
      for(const v of variants){
        const row={product_id:product.id,variant_name:v.name,weight:v.name,price:v.price,stock_quantity:v.stock,is_active:v.active};
        const saved=v.id?await supabaseClient.from('product_variants').update(row).eq('id',v.id):await supabaseClient.from('product_variants').insert(row);
        if(saved.error)throw saved.error;
      }
      closeProductModal();toast(id?'Product updated successfully':'Product added successfully');await refreshAll();
    }catch(err){setMessage(err.message||'Could not save product.');}
    finally{$('saveProduct').disabled=false;$('saveProduct').textContent=$('productId').value?'Save changes':'Save product';}
  });
  async function deleteProduct(id){
    const p=state.products.find(x=>x.id===id);if(!p||!confirm(`Delete "${p.name}" and all its pack sizes? This cannot be undone.`))return;
    const {error}=await supabaseClient.from('products').delete().eq('id',id);if(error){toast(error.message);return;}toast('Product deleted');await refreshAll();
  }
  async function deleteVariant(variantId,productId){
    const p=state.products.find(x=>x.id===productId);
    if((p?.product_variants||[]).length<=1){toast('Keep at least one pack size. Delete the whole product if it is no longer sold.');return;}
    if(!confirm(`Delete this pack size from "${p?.name||'product'}"?`))return;
    const {error}=await supabaseClient.from('product_variants').delete().eq('id',variantId);if(error){toast(error.message);return;}toast('Pack size deleted');await refreshAll();
  }
  init().catch(err=>{$('loginMsg').textContent=err.message||'Unable to initialize admin panel.';});
})();