import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, ExternalLink, Zap, Sliders, Network, Search, HelpCircle } from 'lucide-react'

const categories = [
  { id: 'all', label: 'All Topics' },
  { id: 'playit', label: 'playit.gg (Easiest)' },
  { id: 'portforward', label: 'Port Forwarding' },
  { id: 'other', label: 'Other Methods' }
]

function FaqPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedBlocks, setExpandedBlocks] = useState({
    playit: true // Expand the recommended guide by default
  })

  const toggleBlock = (id) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const faqData = useMemo(() => [
    {
      id: 'playit',
      category: 'playit',
      title: 'Option 1: playit.gg (Recommended / Easiest)',
      icon: Zap,
      iconColor: 'var(--color-warning)',
      summary: 'Bypass router configs and firewalls entirely using a global anycast tunnel client.',
      content: (
        <div className="flex flex-col gap-4">
          <p>
            <strong>playit.gg</strong> is a specialized tunneling service built specifically for multiplayer gaming. 
            It bypasses home router firewall configurations and Carrier-Grade NAT (CGNAT) completely by running a 
            lightweight background agent on your server host computer.
          </p>
          
          <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }} className="flex flex-col gap-2">
            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>How it works:</h4>
            <ol className="flex flex-col gap-2" style={{ paddingLeft: '20px', listStyleType: 'decimal' }}>
              <li>
                Download and run the local <strong><code>playit.exe</code></strong> agent on the Windows computer hosting your Minecraft server.
              </li>
              <li>
                The agent runs in a command-line terminal and automatically outputs a unique <strong>association claim link</strong>.
              </li>
              <li>
                Click the link or copy-paste it into a web browser to register and claim the agent on your playit.gg account.
              </li>
              <li>
                playit.gg automatically assigns a public server address (e.g. <code>random-string.ply.gg</code> or <code>joinmc.link</code> domain) and tunnels incoming connections directly to your local port <code>25565</code>.
              </li>
              <li>
                Give this assigned address to your friends. They can connect directly through Minecraft without needing to know your public IP address!
              </li>
            </ol>
          </div>

          <div style={{ background: 'rgba(147, 51, 234, 0.05)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)' }} className="flex flex-col gap-2">
            <h4 style={{ color: 'var(--color-primary-hover)', fontWeight: 600 }}>Tiers and Resource Limits:</h4>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: '20px', listStyleType: 'disc' }}>
              <li>
                <strong>Free Tier:</strong> Includes up to 2 active tunnel agents, 4 allocated ports, and routes traffic via Global Anycast (automatically routes to the closest server).
              </li>
              <li>
                <strong>Premium Tier (~$3/month):</strong> Unlocks regional routing (forces traffic through specific low-latency regional nodes like US-East or EU-Central), custom domain names (e.g., <code>myserver.joinmc.link</code>), and dedicated static IPs.
              </li>
            </ul>
          </div>

          <div className="flex gap-sm" style={{ marginTop: 'var(--space-sm)' }}>
            <a 
              href="https://playit.gg" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-outline btn-premium btn-sm no-drag"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <ExternalLink size={14} /> Visit playit.gg Website
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'portforward',
      category: 'portforward',
      title: 'Option 2: Manual Port Forwarding (Advanced / Traditional)',
      icon: Sliders,
      iconColor: 'var(--color-primary-hover)',
      summary: 'Configure your home router to forward port 25565 directly to your server machine.',
      content: (
        <div className="flex flex-col gap-4">
          <p>
            Port forwarding is the traditional, zero-overhead way to host a Minecraft server. It instructs your router 
            to redirect incoming Minecraft traffic from the outside world directly to the hosting machine.
          </p>

          <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }} className="flex flex-col gap-2">
            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Step-by-Step Instructions:</h4>
            <ol className="flex flex-col gap-2" style={{ paddingLeft: '20px', listStyleType: 'decimal' }}>
              <li>
                <strong>Set a Static IP / DHCP Reservation:</strong> Ensure your hosting computer's local IP address (e.g., <code>192.168.1.100</code>) doesn't change. You can set a static IP inside Windows Network Connections, or configure a DHCP Reservation / Static Lease in your router settings.
              </li>
              <li>
                <strong>Locate Gateway IP:</strong> Open Command Prompt, run <code>ipconfig</code>, and find your <em>Default Gateway</em> IP address (typically <code>192.168.1.1</code>, <code>192.168.0.1</code>, or <code>10.0.0.1</code>).
              </li>
              <li>
                <strong>Log into Router Gateway:</strong> Open a web browser, enter your Gateway IP into the address bar, and log in with your router's administrator credentials (often found on a sticker on the back of the physical router).
              </li>
              <li>
                <strong>Add Port Forwarding Rule:</strong> Navigate to the <em>Port Forwarding</em>, <em>Virtual Server</em>, or <em>NAT</em> settings. Add a new rule:
                <ul style={{ paddingLeft: '20px', listStyleType: 'circle', marginTop: '4px' }} className="flex flex-col gap-1">
                  <li><strong>Service Name:</strong> Minecraft</li>
                  <li><strong>Protocol:</strong> TCP</li>
                  <li><strong>External Port:</strong> 25565 (default Minecraft port)</li>
                  <li><strong>Internal Port:</strong> 25565</li>
                  <li><strong>Internal IP Address:</strong> Enter your computer's static / reserved local IP.</li>
                </ul>
              </li>
              <li>
                <strong>Check Port:</strong> Start the Minecraft server in Craftly, then visit a port checker tool like <code>canyouseeme.org</code> and test port <code>25565</code>.
              </li>
            </ol>
          </div>

          <div style={{ background: 'var(--color-danger-subtle)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(244, 63, 94, 0.3)' }} className="flex flex-col gap-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger-hover)', fontWeight: 600 }}>
              <AlertTriangle size={18} />
              <span>Critical Warning: Carrier-Grade NAT (CGNAT)</span>
            </div>
            <p style={{ fontSize: '14px' }}>
              Many modern ISPs place residential networks behind a shared public IP using <strong>CGNAT</strong>. 
              Subnets on CGNAT are assigned WAN/Internet IP addresses in the <strong><code>100.64.0.0/10</code></strong> range (from <code>100.64.0.0</code> to <code>100.127.255.255</code>).
            </p>
            <p style={{ fontSize: '14px' }}>
              To check, check the Internet/WAN IP address displayed on your router's configuration status page. If it starts with <code>100.64.x.x</code> through <code>100.127.x.x</code>, <strong>standard port forwarding will silently fail</strong> because you do not have a dedicated public IPv4 address. You must use playit.gg, a tunnel, or a mesh VPN instead.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'other',
      category: 'other',
      title: 'Option 3: Other Connection Methods (VPNs, Tunnels & Virtual LAN)',
      icon: Network,
      iconColor: 'var(--color-success)',
      summary: 'Explore Tailscale, ZeroTier, ngrok, Pinggy, and Radmin VPN connection details.',
      content: (
        <div className="flex flex-col gap-4">
          <p>
            If you want to host private games for a select group of friends, or need a quick way to share a local port 
            without accessing a router, you can use these alternative tools.
          </p>

          <div className="flex flex-col gap-3">
            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              1. Mesh VPNs (Highly Secure, Best for Trusted Groups)
            </h4>
            <p>
              Mesh VPNs set up an encrypted private tunnel network directly between peer devices. No ports are opened 
              to the public internet, but <strong>every player must download the client</strong> to join.
            </p>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: '20px', listStyleType: 'disc' }}>
              <li>
                <strong>Tailscale:</strong> Composes a secure mesh network using the WireGuard protocol with SSO login. It is extremely simple to configure and highly secure, but players must be added to your private "tailnet".
              </li>
              <li>
                <strong>ZeroTier:</strong> Establishes virtual Layer-2 Ethernet networks, which allows mDNS and local LAN discovery to work seamlessly across the web.
              </li>
              <li>
                <strong>NetBird:</strong> An open-source mesh VPN alternative that uses a central management panel and peer-to-peer tunnels.
              </li>
            </ul>

            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginTop: 'var(--space-sm)' }}>
              2. Public TCP Tunnels (Temporary Proxy Gateways)
            </h4>
            <p>
              TCP tunneling tools provision an external public address that acts as a proxy gateway forwarding traffic to your computer.
            </p>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: '20px', listStyleType: 'disc' }}>
              <li>
                <strong>ngrok:</strong> A popular developer tunnel. Note that ngrok's free tier requires payment card verification to enable TCP tunneling on port 25565, and includes a strict <strong>1GB/month bandwidth limit</strong>. A Minecraft server can easily exceed this in a single afternoon.
              </li>
              <li>
                <strong>Pinggy:</strong> A zero-install alternative that runs as an SSH command from your terminal (<code>ssh -T -R 25565:localhost:25565 tcp@pinggy.io</code>). However, free sessions expire and close after <strong>60 minutes</strong>, requiring a reconnect and generating a new public address each time.
              </li>
            </ul>

            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginTop: 'var(--space-sm)' }}>
              3. Virtual LAN Clients (Classic Gaming Lobbies)
            </h4>
            <p>
              Virtual LAN utilities create a software-defined local network over the internet.
            </p>
            <ul className="flex flex-col gap-2" style={{ paddingLeft: '20px', listStyleType: 'disc' }}>
              <li>
                <strong>Radmin VPN:</strong> A popular, free, Windows-only virtual LAN tool. You set up a private room with a name and password, and players connect to that room. They can then join your server using your virtual Radmin IP address. This bypasses firewalls easily but does not support macOS or Linux players.
              </li>
            </ul>
          </div>
        </div>
      )
    }
  ], [])

  const filteredFaq = useMemo(() => {
    return faqData.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory
      const matchesSearch = searchQuery.trim() === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [searchQuery, activeCategory, faqData])

  return (
    <div className="slide-up">
      {/* Header section with no-drag */}
      <div className="page-header no-drag" style={{ marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 className="page-title no-drag" style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Help & Networking FAQ
          </h1>
          <p className="page-subtitle no-drag" style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: '4px' }}>
            Learn how to make your Minecraft server accessible to friends over the internet
          </p>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex flex-wrap gap-md items-center justify-between no-drag">
          
          {/* Search bar */}
          <div className="search-container no-drag" style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="input search-input no-drag"
              placeholder="Search help topics or keywords..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Categories select/tabs (using global CSS tabs class) */}
          <div className="tabs no-drag" style={{ margin: 0 }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`tab no-drag ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Accordion Cards Grid */}
      <div className="flex-col gap-md">
        {filteredFaq.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-2xl) 0', textAlign: 'center' }}>
            <HelpCircle size={48} style={{ marginBottom: '16px', opacity: 0.3, color: 'var(--text-secondary)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>No Match Found</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              We couldn't find any guide matching "{searchQuery}". Try searching for playit, port forward, CGNAT, or VPN.
            </p>
          </div>
        ) : (
          filteredFaq.map(item => {
            const IconComponent = item.icon
            const isExpanded = !!expandedBlocks[item.id]
            return (
              <div 
                key={item.id} 
                className={`card no-drag ${isExpanded ? 'glow-purple' : ''}`}
                style={{ 
                  transition: 'all var(--transition-normal)',
                  border: isExpanded ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)'
                }}
              >
                {/* Accordion Header */}
                <button
                  className="w-full text-left flex items-center justify-between no-drag"
                  onClick={() => toggleBlock(item.id)}
                  style={{
                    padding: 'var(--space-md) var(--space-lg)',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '17px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      className="icon-chip primary" 
                      style={{ 
                        margin: 0, 
                        background: 'var(--color-primary-subtle)', 
                        color: item.iconColor || 'var(--color-primary)' 
                      }}
                    >
                      <IconComponent size={16} />
                    </div>
                    <div>
                      <span className="text-pixel" style={{ display: 'block', fontSize: '15px' }}>
                        {item.title}
                      </span>
                      {!isExpanded && (
                        <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '2px' }}>
                          {item.summary}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {isExpanded ? (
                      <ChevronUp size={20} style={{ color: 'var(--text-secondary)' }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </div>
                </button>

                {/* Accordion Content Block */}
                {isExpanded && (
                  <div
                    className="slide-up"
                    style={{
                      padding: '0 var(--space-lg) var(--space-lg) var(--space-lg)',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 'var(--space-md)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      fontSize: '14.5px'
                    }}
                  >
                    {item.content}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default FaqPage
