async function test() {
  console.log('test');

  const resp = await fetch("http://verify.us-east-1.linodeobjects.com/invoices/Lundsingh-1a81b08d-379e-41f5-b0dc-160075ce3078-1728941409132.pdf")

  console.log(await resp.arrayBuffer());
} 

test();